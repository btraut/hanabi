import type { DebugPlayerAction, HanabiBotTurnStatus, HanabiGameData } from '@hanabi/shared';
import { buildBotObservation } from './BotObservation.js';
import type { BotNotepad } from './BotNotepad.js';
import { BotDecisionError, type BotDecision } from './OpenAiBot.js';
import { BOT_FAILURE_MESSAGES, type BotFailureCode, type BotRound } from './BotRound.js';
import { BotRuntime } from './BotRuntime.js';
import Logger from '../../../utils/Logger.js';

export interface BotTurn {
	playerId: string;
	gameData: HanabiGameData;
	round: BotRound;
	opportunity?: 'turn' | 'clue' | 'result';
	sourceClueEventIds?: string[];
	sourceActionEventId?: string;
}

interface BotTurnHooks {
	gameId: string;
	getTurn: () => BotTurn | null;
	persist: () => Promise<void>;
	notify: () => void;
	onFailure?: () => void;
	apply: (playerId: string, action: DebugPlayerAction, decision?: BotDecision) => string | null;
	applyResultResponse?: (
		playerId: string,
		decision: BotDecision,
		sourceActionEventId: string,
	) => string | null;
	applyClueResponse?: (
		playerId: string,
		decision: BotDecision,
		sourceClueEventIds: string[],
	) => string | null;
}

// Preserve complete history and report oversized input without dropping evidence.
export const MAX_BOT_INPUT_BYTES = 512_000;

function withAbort<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
	return new Promise((resolve, reject) => {
		const abort = () => reject(new BotDecisionError('timeout'));
		signal.addEventListener('abort', abort, { once: true });
		promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
		if (signal.aborted) abort();
	});
}

/** Coordinates one game; only the observation crosses the provider boundary. */
export class BotTurnCoordinator {
	private started = false;
	private running = false;
	private scheduled = false;
	private epoch = 0;
	private controller: AbortController | null = null;
	private availabilityTimer: ReturnType<typeof setTimeout> | null = null;
	private recoveryTimer: ReturnType<typeof setTimeout> | null = null;
	private recoveryTurn: BotTurn | null = null;
	private failures = 0;

	constructor(
		private readonly runtime: BotRuntime,
		private readonly hooks: BotTurnHooks,
	) {}

	start(): void {
		if (this.started) return;
		this.started = true;
		const round = this.hooks.getTurn()?.round;
		if (round && ['error', 'exhausted'].includes(round.status)) {
			round.status = 'ready';
			delete round.failure;
			this.hooks.notify();
		}
		this.schedule();
	}

	stop(): void {
		this.started = false;
		this.epoch += 1;
		this.controller?.abort();
		if (this.availabilityTimer) clearTimeout(this.availabilityTimer);
		this.availabilityTimer = null;
		this.clearRecovery();
	}

	changed(): void {
		this.epoch += 1;
		this.controller?.abort();
		if (this.availabilityTimer) clearTimeout(this.availabilityTimer);
		this.availabilityTimer = null;
		const turn = this.hooks.getTurn();
		if (!this.sameOpportunity(this.recoveryTurn, turn) || turn?.round.status !== 'error') {
			this.clearRecovery();
		}
		this.schedule();
	}

	status(): HanabiBotTurnStatus | null {
		const turn = this.hooks.getTurn();
		if (!turn) return null;
		const { round, playerId } = turn;
		if (round.status === 'ready' || round.status === 'thinking') {
			return {
				playerId,
				status: 'thinking',
				canRetry: false,
				...(turn.opportunity ? { opportunity: turn.opportunity } : {}),
			};
		}
		return {
			playerId,
			...(turn.opportunity ? { opportunity: turn.opportunity } : {}),
			status: round.failure === 'unavailable' ? 'disabled' : round.status,
			message:
				round.failure === 'round_budget' || round.failure === 'global_budget'
					? undefined
					: BOT_FAILURE_MESSAGES[round.failure ?? 'transient'],
			canRetry: false,
		};
	}

	// Retain the message handler for older clients; recovery is owned by the server.
	retry(): string {
		return 'Bot recovery is automatic.';
	}

	private sameOpportunity(left: BotTurn | null, right: BotTurn | null): boolean {
		return (
			!!left &&
			!!right &&
			left.round === right.round &&
			left.playerId === right.playerId &&
			left.opportunity === right.opportunity &&
			JSON.stringify(left.sourceClueEventIds ?? []) ===
				JSON.stringify(right.sourceClueEventIds ?? [])
		);
	}

	private clearRecovery(): void {
		if (this.recoveryTimer) clearTimeout(this.recoveryTimer);
		this.recoveryTimer = null;
		this.recoveryTurn = null;
		this.failures = 0;
	}

	private recover(turn: BotTurn): void {
		this.recoveryTurn = turn;
		const delayMs = Math.min(2_000 * 2 ** Math.min(this.failures, 4), 30_000);
		this.failures += 1;
		this.recoveryTimer = setTimeout(() => {
			this.recoveryTimer = null;
			this.recoveryTurn = null;
			const current = this.hooks.getTurn();
			if (
				this.started &&
				this.sameOpportunity(turn, current) &&
				current &&
				['error', 'exhausted'].includes(current.round.status)
			) {
				current.round.status = 'ready';
				delete current.round.failure;
				this.hooks.notify();
			}
			this.schedule();
		}, delayMs);
		this.recoveryTimer.unref();
	}

	private schedule(): void {
		if (!this.started || this.scheduled || this.running) return;
		this.scheduled = true;
		queueMicrotask(() => {
			this.scheduled = false;
			const turn = this.hooks.getTurn();
			if (
				!this.started ||
				this.running ||
				!turn ||
				this.availabilityTimer !== null ||
				this.recoveryTimer !== null
			)
				return;
			if (!['ready', 'thinking'].includes(turn.round.status)) {
				if (turn.opportunity !== 'result') this.recover(turn);
				return;
			}
			this.running = true;
			const epoch = this.epoch;
			const revision = turn.round.revision;
			const controller = new AbortController();
			this.controller = controller;
			void this.run(turn, epoch, revision, controller)
				.catch(() => {
					if (this.isCurrent(turn, epoch, revision)) this.fail(turn.round, 'transient');
				})
				.finally(() => {
					this.running = false;
					this.controller = null;
					this.schedule();
				});
		});
	}

	private isCurrent(turn: BotTurn, epoch: number, revision: number): boolean {
		const current = this.hooks.getTurn();
		return (
			this.started &&
			this.epoch === epoch &&
			current?.round === turn.round &&
			current.playerId === turn.playerId &&
			current.round.revision === revision
		);
	}

	private fail(round: BotRound, code: BotFailureCode): void {
		const opportunity = this.hooks.getTurn()?.opportunity ?? 'turn';
		round.status = 'error';
		round.failure = code;
		this.hooks.onFailure?.();
		this.hooks.notify();
		Logger.warn(
			`Bot decision failed game=${this.hooks.gameId} opportunity=${opportunity} code=${code}`,
		);
	}

	private async run(
		turn: BotTurn,
		epoch: number,
		revision: number,
		controller: AbortController,
	): Promise<void> {
		const { round } = turn;
		const observation = buildBotObservation(
			turn.gameData,
			turn.playerId,
			round.history,
			round.version,
		);
		const notepad: BotNotepad | undefined =
			round.policy.notepadVersion === 1
				? structuredClone(round.notepads?.[turn.playerId] ?? { version: 1, entries: [] })
				: undefined;
		const isTurn = !turn.opportunity || turn.opportunity === 'turn';
		const isResult = turn.opportunity === 'result';
		const legalActions = isTurn ? observation.legalActions : [];
		if (!isTurn) observation.legalActions = [];
		if (isResult) {
			const source =
				round.history.version === 2
					? round.history.events.find((event) => event.eventId === turn.sourceActionEventId)
					: undefined;
			if (
				!round.policy.reflectionAfterAction ||
				!source ||
				(source.type !== 'play' && source.type !== 'discard') ||
				source.actorId !== turn.playerId
			) {
				this.fail(round, 'invalid_action');
				return;
			}
		}
		if (isTurn && !legalActions.length) {
			this.fail(round, 'invalid_action');
			return;
		}
		// UTF-8 bytes conservatively bound input tokens without sending state to a tokenizer service.
		const inputBytes = Buffer.byteLength(
			JSON.stringify(notepad ? { ...observation, privateNotepad: notepad } : observation) +
				round.policy.instructions,
			'utf8',
		);
		if (round.version === 2 && inputBytes > MAX_BOT_INPUT_BYTES) {
			this.fail(round, 'input_too_large');
			return;
		}
		const estimatedTokens =
			inputBytes +
			Buffer.byteLength(JSON.stringify(legalActions.map(({ id }) => id)), 'utf8') +
			(isResult ? this.runtime.limits.resultMaxOutputTokens : this.runtime.limits.maxOutputTokens) +
			1_024;
		const timeout = setTimeout(
			() => controller.abort(),
			isResult ? this.runtime.limits.resultTimeoutMs : this.runtime.limits.timeoutMs,
		);
		timeout.unref();
		try {
			for (let attempt = 0; attempt < (isResult ? 1 : 2); attempt += 1) {
				if (!this.isCurrent(turn, epoch, revision)) return;
				if (controller.signal.aborted) {
					this.fail(round, 'timeout');
					return;
				}
				const reservation = this.runtime.reserve();
				if (reservation === 'busy') {
					if (isResult) {
						this.fail(round, 'busy');
						return;
					}
					// Wait for shared capacity without requiring a player's manual retry.
					round.status = 'ready';
					delete round.failure;
					this.availabilityTimer = setTimeout(() => {
						this.availabilityTimer = null;
						this.schedule();
					}, 1_000);
					this.availabilityTimer.unref();
					this.hooks.notify();
					return;
				}
				round.attempts += 1;
				round.tokens += estimatedTokens;
				round.lastAttemptAt = Date.now();
				round.status = 'thinking';
				delete round.failure;
				let usedTokens: number | undefined;
				let persisted = false;
				const startedAt = Date.now();
				try {
					this.hooks.notify();
					await withAbort(this.hooks.persist(), controller.signal);
					persisted = true;
					if (!this.isCurrent(turn, epoch, revision)) return;
					if (controller.signal.aborted) {
						this.fail(round, 'timeout');
						return;
					}
					const result = await withAbort(
						this.runtime.provider.chooseAction({
							observation,
							legalActions,
							policy: round.policy,
							...(notepad ? { notepad: structuredClone(notepad) } : {}),
							...(round.version === 2
								? {
										opportunity: turn.opportunity ?? 'turn',
										sourceClueEventIds: isResult ? [] : [...(turn.sourceClueEventIds ?? [])],
										...(isResult
											? {
													sourceActionEventId: turn.sourceActionEventId,
													resultTimeoutMs: this.runtime.limits.resultTimeoutMs,
													resultMaxOutputTokens: this.runtime.limits.resultMaxOutputTokens,
												}
											: {}),
									}
								: {}),
							signal: controller.signal,
						}),
						controller.signal,
					);
					if (!this.isCurrent(turn, epoch, revision)) return;
					if (result.inputTokens !== undefined && result.outputTokens !== undefined) {
						const total = result.inputTokens + result.outputTokens;
						if (Number.isSafeInteger(total) && total >= 0) {
							usedTokens = total;
							round.tokens += total - estimatedTokens;
						}
					}
					const selected = legalActions.find(({ id }) => id === result.actionId);
					if ((isTurn && !selected) || (!isTurn && result.actionId !== null)) {
						this.fail(round, 'invalid_action');
						return;
					}
					const error = isResult
						? this.hooks.applyResultResponse
							? this.hooks.applyResultResponse(turn.playerId, result, turn.sourceActionEventId!)
							: 'Result responses are unavailable.'
						: turn.opportunity === 'clue'
							? this.hooks.applyClueResponse
								? this.hooks.applyClueResponse(turn.playerId, result, turn.sourceClueEventIds ?? [])
								: 'Clue responses are unavailable.'
							: round.version === 2
								? this.hooks.apply(turn.playerId, selected!.action, result)
								: this.hooks.apply(turn.playerId, selected!.action);
					if (error) {
						this.fail(round, 'invalid_action');
						return;
					}
					this.failures = 0;
					Logger.info(
						`Bot decision game=${this.hooks.gameId} model=${round.policy.model} policy=${round.policy.hash} latencyMs=${Date.now() - startedAt} tokens=${usedTokens ?? 'unknown'}`,
					);
					return;
				} catch (error) {
					if (!this.isCurrent(turn, epoch, revision)) return;
					const code: BotFailureCode = !persisted
						? 'save_failed'
						: controller.signal.aborted
							? 'timeout'
							: error instanceof BotDecisionError && error.code !== 'cancelled'
								? error.code
								: 'transient';
					if (
						!isResult &&
						attempt === 0 &&
						!controller.signal.aborted &&
						['transient', 'rate_limit'].includes(code)
					)
						continue;
					this.fail(round, code);
					return;
				} finally {
					reservation.release();
				}
			}
		} finally {
			clearTimeout(timeout);
		}
	}
}
