import {
	generateHanabiGameData,
	generatePlayer,
	HanabiStage,
	HanabiGameActionType,
	type DebugPlayerAction,
} from '@hanabi/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { appendBotArrangement, appendBotHistory, createBotHistory } from './BotHistory.js';
import { createBotPolicy, createRoundBotPolicy } from './BotPolicy.js';
import { isBotRound, type BotRound } from './BotRound.js';
import { BotRuntime, type BotLimits } from './BotRuntime.js';
import { BotTurnCoordinator, MAX_BOT_INPUT_BYTES, type BotTurn } from './BotTurnCoordinator.js';
import { BotDecisionError, type BotDecision, type BotDecisionProvider } from './OpenAiBot.js';

function deferred<T>() {
	let resolve!: (value: T) => void;
	let reject!: (reason: unknown) => void;
	const promise = new Promise<T>((done, fail) => {
		resolve = done;
		reject = fail;
	});
	return { promise, resolve, reject };
}

async function flush() {
	for (let index = 0; index < 40; index += 1) await Promise.resolve();
}

function botTurn(roundOverrides: Partial<BotRound> = {}, tileId = 'own'): BotTurn {
	const gameData = generateHanabiGameData({
		seed: 'round-1',
		stage: HanabiStage.Playing,
		players: {
			bot: generatePlayer({ id: 'bot', name: 'Bot', kind: 'bot' }),
			human: generatePlayer({ id: 'human', name: 'Human' }),
		},
		turnOrder: ['bot', 'human'],
		currentPlayerId: 'bot',
		clues: 7,
		tiles: {
			[tileId]: { id: tileId, color: 'red', number: 1 },
			other: { id: 'other', color: 'blue', number: 2 },
		},
		playerTiles: { bot: [tileId], human: ['other'] },
	});
	return {
		playerId: 'bot',
		gameData,
		round: {
			version: 1,
			roundId: gameData.seed,
			policy: createBotPolicy('test-model', ''),
			history: createBotHistory(gameData),
			revision: 0,
			attempts: 0,
			tokens: 0,
			status: 'ready',
			lastAttemptAt: 0,
			...roundOverrides,
		},
	};
}

function resultTurn(stage = HanabiStage.Playing): BotTurn {
	const turn = botTurn();
	const before = structuredClone(turn.gameData);
	const initial = createBotHistory(before, 2);
	turn.gameData.stage = stage;
	turn.gameData.tiles = { ...turn.gameData.tiles, draw: { id: 'draw', color: 'green', number: 4 } };
	turn.gameData.playerTiles = { ...turn.gameData.playerTiles, bot: ['draw'] };
	turn.round.version = 2;
	turn.round.pendingClues = [];
	turn.round.pendingResult = { playerId: 'bot', eventId: 'event-1' };
	turn.round.policy = createRoundBotPolicy(turn.round.policy, turn.gameData);
	turn.round.history = appendBotHistory(
		initial,
		{
			id: 'action-1',
			type: HanabiGameActionType.Play,
			playerId: 'bot',
			tile: before.tiles.own,
			valid: true,
			remainingLives: turn.gameData.lives,
		},
		turn.gameData,
		before,
	);
	turn.opportunity = 'result';
	turn.sourceActionEventId = 'event-1';
	return turn;
}

function harness(
	options: {
		turn?: BotTurn;
		provider?: BotDecisionProvider;
		runtime?: BotRuntime;
		limits?: Partial<BotLimits>;
		persist?: () => Promise<void>;
		apply?: (playerId: string, action: DebugPlayerAction) => string | null;
	} = {},
) {
	let current: BotTurn | null = options.turn ?? botTurn();
	const original = current;
	const chooseAction = vi
		.fn<BotDecisionProvider['chooseAction']>()
		.mockResolvedValue({ actionId: 'action-0', inputTokens: 100, outputTokens: 5 });
	const runtime =
		options.runtime ??
		new BotRuntime(options.provider ?? { chooseAction }, original.round.policy, {
			timeoutMs: 1_000,
			...options.limits,
		});
	const snapshots: BotRound[] = [];
	const notify = vi.fn(() => {
		if (current) snapshots.push(structuredClone(current.round));
	});
	const persist = vi.fn(options.persist ?? (() => Promise.resolve()));
	const apply = vi.fn((playerId: string, action: DebugPlayerAction) => {
		if (options.apply) return options.apply(playerId, action);
		current = null;
		return null;
	});
	const coordinator = new BotTurnCoordinator(runtime, {
		gameId: 'test-game',
		getTurn: () => current,
		persist,
		notify,
		apply,
	});
	return {
		coordinator,
		runtime,
		chooseAction,
		original,
		notify,
		persist,
		apply,
		snapshots,
		setTurn: (turn: BotTurn | null) => {
			current = turn;
		},
	};
}

describe('BotTurnCoordinator', () => {
	const coordinators: BotTurnCoordinator[] = [];
	beforeEach(() => {
		vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
		vi.setSystemTime(new Date('2026-09-04T20:00:00Z'));
	});
	afterEach(async () => {
		for (const coordinator of coordinators.splice(0)) coordinator.stop();
		await flush();
		vi.useRealTimers();
	});

	function tracked(options: Parameters<typeof harness>[0] = {}) {
		const value = harness(options);
		coordinators.push(value.coordinator);
		return value;
	}

	it('starts only on explicit activation and persists the reserved budget before a single provider call', async () => {
		const saved = deferred<void>();
		const h = tracked({ persist: () => saved.promise });
		await flush();
		expect(h.chooseAction).not.toHaveBeenCalled();
		h.coordinator.start();
		h.coordinator.start();
		await flush();
		expect(h.persist).toHaveBeenCalledTimes(1);
		expect(h.original.round).toMatchObject({ attempts: 1, status: 'thinking' });
		expect(h.original.round.tokens).toBeGreaterThan(0);
		expect(h.coordinator.status()).toEqual({
			playerId: 'bot',
			status: 'thinking',
			canRetry: false,
		});
		expect(h.chooseAction).not.toHaveBeenCalled();
		saved.resolve();
		await flush();
		expect(h.chooseAction).toHaveBeenCalledTimes(1);
		expect(h.apply).toHaveBeenCalledExactlyOnceWith('bot', { type: 'play', tileId: 'own' });
		expect(h.original.round.tokens).toBe(105);
		expect(h.coordinator.status()).toBeNull();
	});

	it('does not run the provider when saving its reservation fails', async () => {
		const h = tracked({ persist: () => Promise.reject(new Error('storage unavailable')) });
		h.coordinator.start();
		await flush();
		expect(h.chooseAction).not.toHaveBeenCalled();
		expect(h.apply).not.toHaveBeenCalled();
		expect(h.original.round).toMatchObject({
			status: 'error',
			failure: 'save_failed',
			attempts: 1,
		});
		expect(h.snapshots.at(-1)).toMatchObject({ status: 'error', failure: 'save_failed' });
	});

	it('keeps at most one inference in flight and cannot retry a thinking turn', async () => {
		const pending = deferred<BotDecision>();
		const provider = {
			chooseAction: vi.fn<BotDecisionProvider['chooseAction']>().mockReturnValue(pending.promise),
		};
		const h = tracked({ provider });
		h.coordinator.start();
		await flush();
		for (let index = 0; index < 4; index += 1) h.coordinator.start();
		await flush();
		expect(provider.chooseAction).toHaveBeenCalledTimes(1);
		expect(h.coordinator.retry()).toBe('Bot recovery is automatic.');
		pending.resolve({ actionId: 'action-0' });
		await flush();
		expect(h.apply).toHaveBeenCalledTimes(1);
	});

	it('aborts an old round and ignores its late response after a replacement round', async () => {
		const stale = deferred<BotDecision>();
		const provider = {
			chooseAction: vi
				.fn<BotDecisionProvider['chooseAction']>()
				.mockReturnValueOnce(stale.promise)
				.mockResolvedValue({ actionId: 'action-0' }),
		};
		const h = tracked({ provider });
		h.coordinator.start();
		await flush();
		const signal = provider.chooseAction.mock.calls[0][0].signal;
		const replacement = botTurn({ roundId: 'round-2' }, 'new-own');
		h.setTurn(replacement);
		h.coordinator.changed();
		await flush();
		expect(signal.aborted).toBe(true);
		expect(provider.chooseAction).toHaveBeenCalledTimes(2);
		expect(h.apply).toHaveBeenCalledExactlyOnceWith('bot', { type: 'play', tileId: 'new-own' });
		stale.resolve({ actionId: 'action-0' });
		await flush();
		expect(h.apply).toHaveBeenCalledTimes(1);
	});

	it('replaces a stale observation after public hand rearrangement', async () => {
		const stale = deferred<BotDecision>();
		const provider = {
			chooseAction: vi
				.fn<BotDecisionProvider['chooseAction']>()
				.mockReturnValueOnce(stale.promise)
				.mockResolvedValue({ actionId: 'action-0' }),
		};
		const h = tracked({ provider });
		h.coordinator.start();
		await flush();
		h.original.gameData.tilePositions = { own: { x: 100, y: 80, z: 1 } };
		h.original.round.revision += 1;
		h.original.round.status = 'ready';
		h.coordinator.changed();
		await flush();
		expect(provider.chooseAction).toHaveBeenCalledTimes(2);
		expect(provider.chooseAction.mock.calls[1][0].observation.players[0].hand[0].position).toEqual({
			x: 100,
			y: 80,
			z: 1,
		});
		stale.resolve({ actionId: 'action-1' });
		await flush();
		expect(h.apply).toHaveBeenCalledExactlyOnceWith('bot', { type: 'play', tileId: 'own' });
	});

	it('stops mutations and releases its slot when stopped during an uncooperative inference', async () => {
		const pending = deferred<BotDecision>();
		const provider = {
			chooseAction: vi.fn<BotDecisionProvider['chooseAction']>().mockReturnValue(pending.promise),
		};
		const h = tracked({ provider, limits: { maxConcurrent: 1 } });
		h.coordinator.start();
		await flush();
		h.coordinator.stop();
		await flush();
		expect(provider.chooseAction.mock.calls[0][0].signal.aborted).toBe(true);
		expect(typeof h.runtime.reserve()).toBe('object');
		const notifications = h.notify.mock.calls.length;
		pending.resolve({ actionId: 'action-0' });
		await flush();
		expect(h.apply).not.toHaveBeenCalled();
		expect(h.notify).toHaveBeenCalledTimes(notifications);
	});

	it('enforces the total deadline even if the provider ignores cancellation', async () => {
		const pending = deferred<BotDecision>();
		const provider = {
			chooseAction: vi.fn<BotDecisionProvider['chooseAction']>().mockReturnValue(pending.promise),
		};
		const h = tracked({ provider });
		h.coordinator.start();
		await flush();
		await vi.advanceTimersByTimeAsync(1_000);
		await flush();
		expect(h.original.round).toMatchObject({ status: 'error', failure: 'timeout', attempts: 1 });
		expect(h.coordinator.status()).toMatchObject({ status: 'error', canRetry: false });
		expect(provider.chooseAction).toHaveBeenCalledTimes(1);
		pending.resolve({ actionId: 'action-0' });
		await flush();
		expect(h.apply).not.toHaveBeenCalled();
	});

	it('automatically retries a timed-out turn with a fresh deadline and ignores its late response', async () => {
		const stale = deferred<BotDecision>();
		const provider = {
			chooseAction: vi
				.fn<BotDecisionProvider['chooseAction']>()
				.mockReturnValueOnce(stale.promise)
				.mockResolvedValue({ actionId: 'action-0' }),
		};
		const h = tracked({ provider });
		h.coordinator.start();
		await flush();
		await vi.advanceTimersByTimeAsync(1_000);
		expect(h.coordinator.status()).toMatchObject({ status: 'error', canRetry: false });
		await vi.advanceTimersByTimeAsync(2_000);
		expect(provider.chooseAction).toHaveBeenCalledTimes(2);
		expect(provider.chooseAction.mock.calls[1][0].signal.aborted).toBe(false);
		expect(h.apply).toHaveBeenCalledOnce();
		stale.resolve({ actionId: 'action-1' });
		await flush();
		expect(h.apply).toHaveBeenCalledOnce();
	});

	it('backs off repeated failures without requiring a player retry or monopolizing capacity', async () => {
		const provider = {
			chooseAction: vi
				.fn<BotDecisionProvider['chooseAction']>()
				.mockRejectedValue(new BotDecisionError('incomplete')),
		};
		const h = tracked({ provider, limits: { maxConcurrent: 1 } });
		h.coordinator.start();
		await flush();
		for (const delay of [2_000, 4_000, 8_000, 16_000, 30_000, 30_000]) {
			const before = provider.chooseAction.mock.calls.length;
			h.coordinator.start();
			const reservation = h.runtime.reserve();
			expect(reservation).not.toBe('busy');
			if (reservation !== 'busy') reservation.release();
			await vi.advanceTimersByTimeAsync(delay - 1);
			expect(provider.chooseAction).toHaveBeenCalledTimes(before);
			await vi.advanceTimersByTimeAsync(1);
			expect(provider.chooseAction).toHaveBeenCalledTimes(before + 1);
		}
		expect(h.persist).toHaveBeenCalledTimes(7);
	});

	it('cancels automatic recovery on stop and recovers immediately on restart', async () => {
		const provider = {
			chooseAction: vi
				.fn<BotDecisionProvider['chooseAction']>()
				.mockRejectedValueOnce(new BotDecisionError('refused'))
				.mockResolvedValue({ actionId: 'action-0' }),
		};
		const h = tracked({ provider });
		h.coordinator.start();
		await flush();
		h.coordinator.stop();
		await vi.advanceTimersByTimeAsync(60_000);
		expect(provider.chooseAction).toHaveBeenCalledOnce();
		h.coordinator.start();
		await flush();
		expect(h.apply).toHaveBeenCalledOnce();
	});

	it('replaces a failed round immediately and cancels its pending recovery', async () => {
		const provider = {
			chooseAction: vi
				.fn<BotDecisionProvider['chooseAction']>()
				.mockRejectedValueOnce(new BotDecisionError('refused'))
				.mockResolvedValue({ actionId: 'action-0' }),
		};
		const h = tracked({ provider });
		h.coordinator.start();
		await flush();
		h.setTurn(botTurn({ roundId: 'new-round' }, 'replacement'));
		h.coordinator.changed();
		await flush();
		expect(h.apply).toHaveBeenCalledExactlyOnceWith('bot', { type: 'play', tileId: 'replacement' });
		await vi.advanceTimersByTimeAsync(60_000);
		expect(provider.chooseAction).toHaveBeenCalledTimes(2);
	});

	it('automatically recovers an already-failed replacement opportunity', async () => {
		const h = tracked();
		h.coordinator.start();
		await flush();
		h.setTurn(botTurn({ roundId: 'replacement', status: 'error', failure: 'timeout' }, 'new-own'));
		h.coordinator.changed();
		await flush();
		await vi.advanceTimersByTimeAsync(2_000);
		expect(h.chooseAction).toHaveBeenCalledTimes(2);
		expect(h.apply).toHaveBeenLastCalledWith('bot', { type: 'play', tileId: 'new-own' });
	});

	it('retains automatic recovery through unrelated hand movement', async () => {
		const provider = {
			chooseAction: vi
				.fn<BotDecisionProvider['chooseAction']>()
				.mockRejectedValueOnce(new BotDecisionError('incomplete'))
				.mockResolvedValue({ actionId: 'action-0' }),
		};
		const h = tracked({ provider });
		h.coordinator.start();
		await flush();
		await vi.advanceTimersByTimeAsync(1_000);
		h.original.gameData.tilePositions = { own: { x: 120, y: 40, z: 1 } };
		h.original.round.revision += 1;
		h.coordinator.changed();
		await vi.advanceTimersByTimeAsync(1_000);
		expect(provider.chooseAction).toHaveBeenCalledTimes(2);
		expect(provider.chooseAction.mock.calls[1][0].observation.players[0].hand[0].position).toEqual({
			x: 120,
			y: 40,
			z: 1,
		});
		expect(h.apply).toHaveBeenCalledOnce();
	});

	it('retries transient failures immediately once, then automatically backs off', async () => {
		const provider = {
			chooseAction: vi
				.fn<BotDecisionProvider['chooseAction']>()
				.mockRejectedValue(new BotDecisionError('transient')),
		};
		const h = tracked({ provider });
		h.coordinator.start();
		await flush();
		expect(provider.chooseAction).toHaveBeenCalledTimes(2);
		expect(h.persist).toHaveBeenCalledTimes(2);
		expect(h.original.round).toMatchObject({ attempts: 2, status: 'error', failure: 'transient' });
		expect(h.coordinator.retry()).toBe('Bot recovery is automatic.');
		await vi.advanceTimersByTimeAsync(2_000);
		expect(h.coordinator.retry()).not.toBeNull();
		await flush();
		expect(provider.chooseAction).toHaveBeenCalledTimes(4);
	});

	it('retries a rate limit once and applies a successful response exactly once', async () => {
		const provider = {
			chooseAction: vi
				.fn<BotDecisionProvider['chooseAction']>()
				.mockRejectedValueOnce(new BotDecisionError('rate_limit'))
				.mockResolvedValue({ actionId: 'action-0' }),
		};
		const h = tracked({ provider });
		h.coordinator.start();
		await flush();
		expect(provider.chooseAction).toHaveBeenCalledTimes(2);
		expect(h.original.round.attempts).toBe(2);
		expect(h.apply).toHaveBeenCalledTimes(1);
	});

	it('shares one deadline across the transient retry', async () => {
		const first = deferred<BotDecision>();
		const second = deferred<BotDecision>();
		const provider = {
			chooseAction: vi
				.fn<BotDecisionProvider['chooseAction']>()
				.mockReturnValueOnce(first.promise)
				.mockReturnValue(second.promise),
		};
		const h = tracked({ provider });
		h.coordinator.start();
		await flush();
		await vi.advanceTimersByTimeAsync(700);
		first.reject(new BotDecisionError('transient'));
		await flush();
		expect(provider.chooseAction).toHaveBeenCalledTimes(2);
		await vi.advanceTimersByTimeAsync(300);
		await flush();
		expect(h.original.round).toMatchObject({ status: 'error', failure: 'timeout', attempts: 2 });
		expect(h.apply).not.toHaveBeenCalled();
	});

	it('allows the automatic transient retry after extensive round usage', async () => {
		const provider = {
			chooseAction: vi
				.fn<BotDecisionProvider['chooseAction']>()
				.mockRejectedValue(new BotDecisionError('transient')),
		};
		const h = tracked({ provider, turn: botTurn({ attempts: 10_000, tokens: 100_000_000 }) });
		h.coordinator.start();
		await flush();
		expect(provider.chooseAction).toHaveBeenCalledTimes(2);
		expect(h.original.round).toMatchObject({
			attempts: 10_002,
			status: 'error',
			failure: 'transient',
		});
		expect(h.coordinator.status()).toMatchObject({ canRetry: false });
	});

	it('reports unavailable configuration and retries after backoff', async () => {
		const provider = {
			chooseAction: vi
				.fn<BotDecisionProvider['chooseAction']>()
				.mockRejectedValueOnce(new BotDecisionError('unavailable'))
				.mockResolvedValue({ actionId: 'action-0' }),
		};
		const h = tracked({ provider });
		h.coordinator.start();
		await flush();
		expect(h.coordinator.status()).toMatchObject({ status: 'disabled', canRetry: false });
		expect(h.coordinator.retry()).toBe('Bot recovery is automatic.');
		await vi.advanceTimersByTimeAsync(2_000);
		expect(provider.chooseAction).toHaveBeenCalledTimes(2);
		expect(h.apply).toHaveBeenCalledOnce();
	});

	it.each(['refused', 'incomplete', 'invalid_action'] as const)(
		'automatically retries a %s error after backoff',
		async (code) => {
			const provider = {
				chooseAction: vi
					.fn<BotDecisionProvider['chooseAction']>()
					.mockRejectedValue(new BotDecisionError(code)),
			};
			const h = tracked({ provider });
			h.coordinator.start();
			await flush();
			expect(provider.chooseAction).toHaveBeenCalledTimes(1);
			expect(h.original.round).toMatchObject({ status: 'error', failure: code });
			await vi.advanceTimersByTimeAsync(2_000);
			expect(provider.chooseAction).toHaveBeenCalledTimes(2);
		},
	);

	it('rejects an unknown action without making an arbitrary substitute move', async () => {
		const provider = {
			chooseAction: vi
				.fn<BotDecisionProvider['chooseAction']>()
				.mockResolvedValue({ actionId: 'invented-action' }),
		};
		const h = tracked({ provider });
		h.coordinator.start();
		await flush();
		expect(h.apply).not.toHaveBeenCalled();
		expect(h.original.round.failure).toBe('invalid_action');
	});

	it('respects the engine rejecting an action whose legality changed', async () => {
		const h = tracked({ apply: () => 'That tile is no longer available.' });
		h.coordinator.start();
		await flush();
		expect(h.apply).toHaveBeenCalledTimes(1);
		expect(h.original.round).toMatchObject({ status: 'error', failure: 'invalid_action' });
	});

	it('continues requesting bot moves after extensive round usage while retaining usage totals', async () => {
		const h = tracked({ turn: botTurn({ attempts: 10_000, tokens: 100_000_000 }) });
		h.coordinator.start();
		await flush();
		expect(h.chooseAction).toHaveBeenCalledTimes(1);
		expect(h.apply).toHaveBeenCalledTimes(1);
		expect(h.original.round).toMatchObject({
			attempts: 10_001,
			tokens: 100_000_105,
		});
	});

	it('shares concurrency across games without consuming attempts for a blocked game', async () => {
		const pending = deferred<BotDecision>();
		const provider = {
			chooseAction: vi
				.fn<BotDecisionProvider['chooseAction']>()
				.mockReturnValueOnce(pending.promise)
				.mockResolvedValue({ actionId: 'action-0' }),
		};
		const shared = new BotRuntime(provider, createBotPolicy('test-model', ''), {
			maxConcurrent: 1,
		});
		const first = tracked({ runtime: shared });
		const second = tracked({ runtime: shared });
		first.coordinator.start();
		await flush();
		second.coordinator.start();
		await flush();
		expect(second.original.round).toMatchObject({ attempts: 0, status: 'ready' });
		expect(second.coordinator.status()).toMatchObject({ status: 'thinking', canRetry: false });
		expect(provider.chooseAction).toHaveBeenCalledTimes(1);
		pending.resolve({ actionId: 'action-0' });
		await flush();
		await vi.advanceTimersByTimeAsync(1_000);
		await flush();
		expect(provider.chooseAction).toHaveBeenCalledTimes(2);
		expect(second.apply).toHaveBeenCalledTimes(1);
	});

	it('cancels capacity waits when stopped and uses the latest turn when restarted', async () => {
		const h = tracked({ limits: { maxConcurrent: 1 } });
		const occupied = h.runtime.reserve();
		if (occupied === 'busy') throw new Error('Expected a request slot.');
		h.coordinator.start();
		await flush();
		expect(h.chooseAction).not.toHaveBeenCalled();
		h.coordinator.stop();
		occupied.release();
		await vi.advanceTimersByTimeAsync(2_000);
		expect(h.chooseAction).not.toHaveBeenCalled();
		const replacement = botTurn({}, 'replacement');
		h.setTurn(replacement);
		h.coordinator.start();
		await flush();
		expect(h.chooseAction).toHaveBeenCalledOnce();
		expect(h.apply).toHaveBeenCalledWith('bot', expect.objectContaining({ tileId: 'replacement' }));
	});

	it('automatically resumes a restored global-budget failure with usage intact', async () => {
		const saved = botTurn({
			status: 'error',
			failure: 'global_budget',
			attempts: 600,
			tokens: 6_000_000,
		});
		expect(isBotRound(saved.round)).toBe(true);
		const h = tracked({ turn: saved });
		h.coordinator.start();
		await flush();
		expect(h.chooseAction).toHaveBeenCalledOnce();
		expect(h.apply).toHaveBeenCalledOnce();
		expect(saved.round).toMatchObject({ attempts: 601, tokens: 6_000_105 });
	});

	it('resumes a persisted thinking turn with its usage totals intact', async () => {
		const saved = JSON.parse(
			JSON.stringify(botTurn({ status: 'thinking', attempts: 5, tokens: 10_000 })),
		) as BotTurn;
		expect(isBotRound(saved.round)).toBe(true);
		const h = tracked({ turn: saved });
		h.coordinator.start();
		await flush();
		expect(h.chooseAction).toHaveBeenCalledTimes(1);
		expect(saved.round.attempts).toBe(6);
		expect(saved.round.tokens).toBe(10_105);
	});

	it('automatically resumes a restored error with its usage intact', async () => {
		const saved = JSON.parse(
			JSON.stringify(
				botTurn({
					status: 'error',
					failure: 'timeout',
					attempts: 5,
					tokens: 10_000,
				}),
			),
		) as BotTurn;
		const h = tracked({ turn: saved });
		h.coordinator.start();
		await flush();
		expect(h.chooseAction).toHaveBeenCalledOnce();
		expect(h.apply).toHaveBeenCalledOnce();
		expect(saved.round).toMatchObject({ attempts: 6, tokens: 10_105 });
	});

	it('automatically restores unavailable configuration without replacing saved policy or usage totals', async () => {
		const saved = JSON.parse(
			JSON.stringify(
				botTurn({
					status: 'error',
					failure: 'unavailable',
					attempts: 5,
					tokens: 10_000,
					policy: createBotPolicy('saved-model', 'Saved coaching instructions.'),
				}),
			),
		) as BotTurn;
		const expected = structuredClone(saved.round);
		delete expected.failure;
		const chooseAction = vi
			.fn<BotDecisionProvider['chooseAction']>()
			.mockResolvedValue({ actionId: 'action-0', inputTokens: 100, outputTokens: 5 });
		const runtime = new BotRuntime(
			{ chooseAction },
			createBotPolicy('new-model', 'New coaching instructions.'),
		);
		const h = tracked({ turn: saved, runtime });
		h.coordinator.start();
		h.coordinator.start();
		await flush();
		expect(chooseAction).toHaveBeenCalledTimes(1);
		expect(chooseAction.mock.calls[0][0].policy).toEqual(expected.policy);
		expect(saved.round.attempts).toBe(6);
		expect(saved.round.tokens).toBe(10_105);
	});

	it('automatically recovers unavailable turns despite extensive round usage', async () => {
		const saved = botTurn({
			status: 'error',
			failure: 'unavailable',
			attempts: 10_000,
			tokens: 100_000_000,
		});
		const h = tracked({ turn: saved });
		h.coordinator.start();
		await flush();
		await flush();
		expect(h.chooseAction).toHaveBeenCalledTimes(1);
		expect(saved.round.attempts).toBe(10_001);
		expect(saved.round.tokens).toBe(100_000_105);
	});

	it('automatically resumes a restored round stopped by the removed round allowance', async () => {
		const saved = JSON.parse(
			JSON.stringify(
				botTurn({
					status: 'exhausted',
					failure: 'round_budget',
					attempts: 10_000,
					tokens: 100_000_000,
				}),
			),
		) as BotTurn;
		expect(isBotRound(saved.round)).toBe(true);
		const h = tracked({ turn: saved });
		h.coordinator.start();
		await flush();
		expect(h.chooseAction).toHaveBeenCalledTimes(1);
		expect(h.apply).toHaveBeenCalledTimes(1);
		expect(saved.round.attempts).toBe(10_001);
		expect(saved.round.tokens).toBe(100_000_105);
	});

	it.each([
		{ attempts: 10_000, tokens: 0 },
		{ attempts: 0, tokens: 100_000_000 },
	])('automatically recovers a failed turn regardless of round usage: %j', async (used) => {
		const h = tracked({
			turn: botTurn({ status: 'error', failure: 'timeout', ...used }),
		});
		h.coordinator.start();
		await flush();
		await flush();
		expect(h.chooseAction).toHaveBeenCalledTimes(1);
	});
	it('reports oversized v2 history without spending tokens or dropping evidence', async () => {
		const turn = botTurn();
		turn.gameData.tilePositions = { own: { x: 10, y: 10, z: 1 }, other: { x: 10, y: 10, z: 1 } };
		turn.round.version = 2;
		turn.round.pendingClues = [];
		turn.round.policy = createRoundBotPolicy(turn.round.policy, turn.gameData);
		turn.round.history = createBotHistory(turn.gameData, 2);
		for (let index = 0; index < 2500; index += 1) {
			const before = turn.gameData.tilePositions;
			turn.gameData.tilePositions = { ...before, own: { x: index % 2 ? 10 : 60, y: 75, z: 1 } };
			turn.round.history = appendBotArrangement(turn.round.history, 'bot', before, turn.gameData);
		}
		const history = structuredClone(turn.round.history);
		expect(Buffer.byteLength(JSON.stringify(history))).toBeGreaterThan(MAX_BOT_INPUT_BYTES);
		const h = tracked({ turn });
		h.coordinator.start();
		await flush();
		expect(h.coordinator.status()).toMatchObject({ status: 'error', canRetry: false });
		expect(turn.round).toMatchObject({ failure: 'input_too_large', attempts: 0, tokens: 0 });
		expect(h.chooseAction).not.toHaveBeenCalled();
		expect(turn.round.history).toEqual(history);
	});

	it('dispatches off-turn clue responses only through the arrangement hook', async () => {
		const turn = botTurn();
		turn.gameData.currentPlayerId = 'human';
		turn.round.version = 2;
		turn.round.pendingClues = [{ playerId: 'bot', eventIds: ['event-1'] }];
		turn.round.policy = createRoundBotPolicy(turn.round.policy, turn.gameData);
		turn.round.history = createBotHistory(turn.gameData, 2);
		turn.opportunity = 'clue';
		turn.sourceClueEventIds = ['event-1'];
		const decision = {
			actionId: null,
			arrangement: null,
			explanation: 'I will leave my cards in place.',
			notes: null,
		};
		const chooseAction = vi.fn<BotDecisionProvider['chooseAction']>().mockResolvedValue(decision);
		let active: BotTurn | null = turn;
		const apply = vi.fn();
		const applyClueResponse = vi.fn(() => {
			active = null;
			return null;
		});
		const coordinator = new BotTurnCoordinator(
			new BotRuntime({ chooseAction }, turn.round.policy),
			{
				gameId: 'clue-game',
				getTurn: () => active,
				persist: () => Promise.resolve(),
				notify: vi.fn(),
				apply,
				applyClueResponse,
			},
		);
		coordinators.push(coordinator);
		coordinator.start();
		await flush();
		expect(chooseAction.mock.calls[0][0]).toMatchObject({
			opportunity: 'clue',
			sourceClueEventIds: ['event-1'],
			legalActions: [],
		});
		expect(apply).not.toHaveBeenCalled();
		expect(applyClueResponse).toHaveBeenCalledExactlyOnceWith('bot', decision, ['event-1']);
		expect(coordinator.status()).toBeNull();
	});

	it.each([HanabiStage.Playing, HanabiStage.Finished])(
		'dispatches %s results through their hook with brief limits and no actions',
		async (stage) => {
			const turn = resultTurn(stage);
			let active: BotTurn | null = turn;
			const decision = {
				actionId: null,
				arrangement: null,
				explanation: 'The revealed play succeeded.',
				notes: null,
			};
			const chooseAction = vi.fn<BotDecisionProvider['chooseAction']>().mockResolvedValue(decision);
			const apply = vi.fn();
			const applyResultResponse = vi.fn(() => {
				active = null;
				return null;
			});
			const coordinator = new BotTurnCoordinator(
				new BotRuntime({ chooseAction }, turn.round.policy),
				{
					gameId: 'result-game',
					getTurn: () => active,
					persist: () => Promise.resolve(),
					notify: vi.fn(),
					apply,
					applyResultResponse,
				},
			);
			coordinators.push(coordinator);
			coordinator.start();
			await flush();
			expect(chooseAction).toHaveBeenCalledOnce();
			expect(chooseAction.mock.calls[0][0]).toMatchObject({
				opportunity: 'result',
				sourceActionEventId: 'event-1',
				sourceClueEventIds: [],
				legalActions: [],
				resultTimeoutMs: 5000,
				resultMaxOutputTokens: 2048,
				observation: { stage, legalActions: [] },
			});
			expect(chooseAction.mock.calls[0][0].observation.players[0].hand[0].face).toBeNull();
			expect(applyResultResponse).toHaveBeenCalledExactlyOnceWith('bot', decision, 'event-1');
			expect(apply).not.toHaveBeenCalled();
		},
	);

	it('times out result reflection on its short deadline without another attempt', async () => {
		const chooseAction = vi
			.fn<BotDecisionProvider['chooseAction']>()
			.mockReturnValue(new Promise(() => {}));
		const h = tracked({
			turn: resultTurn(),
			provider: { chooseAction },
			limits: { timeoutMs: 120000, resultTimeoutMs: 50 },
		});
		h.coordinator.start();
		await flush();
		await vi.advanceTimersByTimeAsync(51);
		await flush();
		expect(h.original.round.failure).toBe('timeout');
		expect(chooseAction).toHaveBeenCalledOnce();
		expect(h.original.round.attempts).toBe(1);
		expect(h.apply).not.toHaveBeenCalled();
	});

	it('does not retry transient result errors', async () => {
		const chooseAction = vi
			.fn<BotDecisionProvider['chooseAction']>()
			.mockRejectedValue(new BotDecisionError('transient'));
		const h = tracked({ turn: resultTurn(), provider: { chooseAction } });
		h.coordinator.start();
		await flush();
		expect(h.original.round.failure).toBe('transient');
		expect(chooseAction).toHaveBeenCalledOnce();
	});

	it('rejects missing or foreign result sources before reserving budget', async () => {
		for (const source of [undefined, 'missing']) {
			const turn = resultTurn();
			turn.sourceActionEventId = source;
			const h = tracked({ turn });
			h.coordinator.start();
			await flush();
			expect(h.original.round).toMatchObject({ failure: 'invalid_action', attempts: 0 });
			expect(h.chooseAction).not.toHaveBeenCalled();
		}
		const turn = resultTurn();
		if (turn.round.history.version !== 2) throw new Error('Expected v2');
		turn.round.history.events[0].actorId = 'human';
		const h = tracked({ turn });
		h.coordinator.start();
		await flush();
		expect(h.original.round.failure).toBe('invalid_action');
		expect(h.chooseAction).not.toHaveBeenCalled();
	});

	it('rejects malformed v2 pending queues and mixed policy/history contracts without throwing', () => {
		const turn = botTurn();
		const round: BotRound = {
			...turn.round,
			version: 2,
			policy: createRoundBotPolicy(turn.round.policy, turn.gameData),
			history: createBotHistory(turn.gameData, 2),
			pendingClues: [],
		};
		expect(isBotRound(round)).toBe(true);
		expect(isBotRound({ ...round, pendingResult: { playerId: 'bot', eventId: 'event-1' } })).toBe(
			true,
		);
		for (const pendingResult of [
			null,
			{},
			{ playerId: 'bot', eventId: '' },
			{ playerId: '', eventId: 'event-1' },
		]) {
			expect(isBotRound({ ...round, pendingResult })).toBe(false);
		}
		for (const pendingClues of [
			[null],
			[{}],
			[{ playerId: 'bot', eventIds: [] }],
			[{ playerId: 'bot', eventIds: ['e', 'e'] }],
			[
				{ playerId: 'bot', eventIds: ['e'] },
				{ playerId: 'bot', eventIds: ['f'] },
			],
		]) {
			expect(isBotRound({ ...round, pendingClues })).toBe(false);
		}
		expect(isBotRound({ ...round, history: createBotHistory(turn.gameData) })).toBe(false);
		expect(isBotRound({ ...round, policy: turn.round.policy })).toBe(false);
	});
	it('supplies only the receiving bot notepad as a detached request snapshot', async () => {
		const turn = botTurn();
		turn.round.version = 2;
		turn.round.policy = createRoundBotPolicy(turn.round.policy, turn.gameData);
		turn.round.history = createBotHistory(turn.gameData, 2);
		const checkpoint = { eventId: 'initial', sequence: 0, turnIndex: 0 };
		const entry = {
			decisionId: 'prior-decision',
			opportunity: 'clue' as const,
			observedAt: checkpoint,
			recordedAt: checkpoint,
			sourceClueEventIds: [],
			explanation: 'Leave this card in place.',
			notes: 'A tentative play signal, not a confirmed identity.',
		};
		turn.round.notepads = {
			bot: { version: 1, entries: [entry] },
			anotherBot: { version: 1, entries: [{ ...entry, notes: 'Another seat private note' }] },
		};
		const pending = deferred<BotDecision>();
		const h = tracked({
			turn,
			provider: {
				chooseAction: vi
					.fn()
					.mockImplementation((request: Parameters<BotDecisionProvider['chooseAction']>[0]) => {
						expect(request.notepad).toEqual(turn.round.notepads!.bot);
						expect(JSON.stringify(request)).not.toContain('Another seat private note');
						request.notepad!.entries[0].notes = 'Mutating a request cannot rewrite durable memory';
						return pending.promise;
					}),
			},
		});
		h.coordinator.start();
		await flush();
		expect(turn.round.notepads.bot.entries[0].notes).toBe(
			'A tentative play signal, not a confirmed identity.',
		);
	});

	it('counts the complete private notepad against the request limit without truncating it', async () => {
		const turn = botTurn();
		turn.round.version = 2;
		turn.round.policy = createRoundBotPolicy(turn.round.policy, turn.gameData);
		turn.round.history = createBotHistory(turn.gameData, 2);
		const checkpoint = { eventId: 'initial', sequence: 0, turnIndex: 0 };
		turn.round.notepads = {
			bot: {
				version: 1,
				entries: Array.from({ length: 70 }, (_, index) => ({
					decisionId: `note-${index}`,
					opportunity: 'turn',
					observedAt: checkpoint,
					recordedAt: checkpoint,
					sourceClueEventIds: [],
					explanation: 'A recorded decision summary.',
					notes: 'x'.repeat(8000),
				})),
			},
		};
		const h = tracked({ turn });
		h.coordinator.start();
		await flush();
		expect(turn.round).toMatchObject({ failure: 'input_too_large', attempts: 0 });
		expect(turn.round.notepads.bot.entries).toHaveLength(70);
		expect(h.chooseAction).not.toHaveBeenCalled();
	});
});
