import {
	getHanabiPositionsForLayout,
	HanabiStage,
	type DebugPlayerAction,
	type HanabiHandLayout,
} from '@hanabi/shared';
import OpenAI from 'openai';
import type { BotObservation } from './BotObservation.js';
import type { BotPolicy } from './BotPolicy.js';
import { MAX_BOT_NOTE_LENGTH, type BotNotepad } from './BotNotepad.js';
import { MAX_BOT_EXPLANATION_LENGTH } from './BotDecisionChat.js';

export type BotDecisionOpportunity = 'turn' | 'clue' | 'result';

export interface BotDecisionRequest {
	observation: BotObservation;
	legalActions: readonly { id: string; action: DebugPlayerAction }[];
	policy: BotPolicy;
	signal: AbortSignal;
	opportunity?: BotDecisionOpportunity;
	sourceClueEventIds?: readonly string[];
	sourceActionEventId?: string;
	notepad?: BotNotepad;
	/** Result-only limits supplied by the runtime; gameplay keeps the provider configuration. */
	resultTimeoutMs?: number;
	resultMaxOutputTokens?: number;
}

export interface BotDecision {
	actionId: string | null;
	arrangement?: HanabiHandLayout | null;
	explanation?: string;
	notes?: string | null;
	inputTokens?: number;
	outputTokens?: number;
}

export type V2BotDecision = BotDecision & {
	arrangement: HanabiHandLayout | null;
	explanation: string;
};

/** Validate provider results again at the game boundary, including custom providers. */
export function isV2BotDecision(
	value: unknown,
	ownTileIds: readonly string[],
	allowDragging: boolean,
	opportunity: BotDecisionOpportunity = 'turn',
	notepadEnabled = false,
): value is V2BotDecision {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
	const decision = value as Partial<BotDecision>;
	if (
		(opportunity !== 'turn'
			? decision.actionId !== null
			: typeof decision.actionId !== 'string' || !decision.actionId.trim()) ||
		typeof decision.explanation !== 'string' ||
		!decision.explanation.trim() ||
		decision.explanation.length > MAX_BOT_EXPLANATION_LENGTH ||
		(notepadEnabled &&
			decision.notes !== null &&
			(typeof decision.notes !== 'string' ||
				!decision.notes.trim() ||
				decision.notes.length > MAX_BOT_NOTE_LENGTH)) ||
		!Object.keys(value).every((key) =>
			[
				'actionId',
				'arrangement',
				'explanation',
				'inputTokens',
				'outputTokens',
				...(notepadEnabled ? ['notes'] : []),
			].includes(key),
		)
	)
		return false;
	if (decision.arrangement === null) return true;
	if (
		!allowDragging ||
		!decision.arrangement ||
		!getHanabiPositionsForLayout(ownTileIds, decision.arrangement)
	)
		return false;
	return (
		Object.keys(decision.arrangement).length === 2 &&
		decision.arrangement.lowerArea.every((placement) => Object.keys(placement).length === 4)
	);
}

function decisionSchema(request: BotDecisionRequest, ownTileIds: readonly string[]) {
	const actionIds = request.legalActions.map(({ id }) => id);
	const actionId = { type: 'string', enum: actionIds };
	if (request.policy.contractVersion !== 2) {
		return {
			type: 'object',
			properties: { actionId },
			required: ['actionId'],
			additionalProperties: false,
		};
	}
	const arrangement =
		request.observation.rules.allowDragging &&
		request.observation.stage === HanabiStage.Playing &&
		ownTileIds.length > 0
			? {
					anyOf: [
						{ type: 'null' },
						{
							type: 'object',
							properties: {
								orderedRow: {
									type: 'array',
									items: { type: 'string', enum: ownTileIds },
									maxItems: ownTileIds.length,
								},
								lowerArea: {
									type: 'array',
									maxItems: ownTileIds.length,
									items: {
										type: 'object',
										properties: {
											tileId: { type: 'string', enum: ownTileIds },
											x: { type: 'number', minimum: 0, maximum: 1 },
											y: { type: 'number', minimum: 0, maximum: 1 },
											stackOrder: { type: 'integer', minimum: 0, maximum: Number.MAX_SAFE_INTEGER },
										},
										required: ['tileId', 'x', 'y', 'stackOrder'],
										additionalProperties: false,
									},
								},
							},
							required: ['orderedRow', 'lowerArea'],
							additionalProperties: false,
						},
					],
				}
			: { type: 'null' };
	return {
		type: 'object',
		properties: {
			actionId: request.opportunity && request.opportunity !== 'turn' ? { type: 'null' } : actionId,
			arrangement,
			explanation: { type: 'string', minLength: 1, maxLength: MAX_BOT_EXPLANATION_LENGTH },
			...(request.policy.notepadVersion === 1
				? { notes: { type: ['string', 'null'], minLength: 1, maxLength: MAX_BOT_NOTE_LENGTH } }
				: {}),
		},
		required: [
			'actionId',
			'arrangement',
			'explanation',
			...(request.policy.notepadVersion === 1 ? ['notes'] : []),
		],
		additionalProperties: false,
	};
}

export interface BotDecisionProvider {
	chooseAction(request: BotDecisionRequest): Promise<BotDecision>;
}

export type BotDecisionErrorCode =
	| 'cancelled'
	| 'timeout'
	| 'unavailable'
	| 'rate_limit'
	| 'transient'
	| 'refused'
	| 'incomplete'
	| 'invalid_action';

/** Contains no provider response, player data, prompt, or credential. */
export class BotDecisionError extends Error {
	readonly retryable: boolean;

	constructor(public readonly code: BotDecisionErrorCode) {
		super(`Bot decision failed: ${code}.`);
		this.name = 'BotDecisionError';
		this.retryable = ['timeout', 'rate_limit', 'transient', 'incomplete'].includes(code);
	}
}

export interface OpenAiBotOptions {
	apiKey: string;
	timeoutMs?: number;
	maxOutputTokens?: number;
	fetch?: typeof fetch;
}

export class OpenAiBot implements BotDecisionProvider {
	private readonly client: OpenAI;
	private readonly timeoutMs: number;
	private readonly maxOutputTokens: number;

	constructor(options: OpenAiBotOptions) {
		this.timeoutMs = options.timeoutMs ?? 120_000;
		this.maxOutputTokens = options.maxOutputTokens ?? 16_384;
		this.client = new OpenAI({
			apiKey: options.apiKey,
			timeout: this.timeoutMs,
			maxRetries: 0,
			logLevel: 'off',
			...(options.fetch ? { fetch: options.fetch } : {}),
		});
	}

	async chooseAction(request: BotDecisionRequest): Promise<BotDecision> {
		if (request.signal.aborted) throw new BotDecisionError('cancelled');
		const v2 = request.policy.contractVersion === 2;
		const notepadEnabled = v2 && request.policy.notepadVersion === 1;
		const opportunity = request.opportunity ?? 'turn';
		if (
			(opportunity === 'turn' && request.legalActions.length === 0) ||
			(opportunity === 'clue' && (!v2 || !request.policy.arrangementAfterClue)) ||
			(opportunity === 'result' &&
				(!v2 ||
					!request.policy.reflectionAfterAction ||
					typeof request.sourceActionEventId !== 'string' ||
					!request.sourceActionEventId.trim())) ||
			(opportunity !== 'turn' && request.legalActions.length !== 0)
		) {
			throw new BotDecisionError('invalid_action');
		}
		const actionIds = request.legalActions.map(({ id }) => id);
		const ownTileIds =
			request.observation.players
				.find(({ id }) => id === request.observation.playerId)
				?.hand.map(({ tileId }) => tileId) ?? [];
		const timeoutMs =
			opportunity === 'result' ? (request.resultTimeoutMs ?? 5_000) : this.timeoutMs;
		const maxOutputTokens =
			opportunity === 'result' ? (request.resultMaxOutputTokens ?? 2_048) : this.maxOutputTokens;
		const deadline = AbortSignal.timeout(timeoutMs);
		const signal = AbortSignal.any([request.signal, deadline]);
		// Preserve the effective settings of legacy saved policies.
		const reasoningEffort =
			opportunity === 'result'
				? 'low'
				: (request.policy.reasoningEffort ??
					(request.policy.model.startsWith('gpt-5.4-mini') ? 'none' : undefined));
		try {
			const response = await this.client.responses.create(
				{
					model: request.policy.model,
					instructions: request.policy.instructions,
					input: JSON.stringify(
						v2
							? {
									...request.observation,
									...(opportunity !== 'turn' ? { legalActions: [] } : {}),
									...(notepadEnabled
										? { privateNotepad: request.notepad ?? { version: 1, entries: [] } }
										: {}),
									decisionContext: {
										opportunity,
										sourceClueEventIds:
											opportunity === 'result' ? [] : (request.sourceClueEventIds ?? []),
										...(opportunity === 'result'
											? { sourceActionEventId: request.sourceActionEventId }
											: {}),
									},
								}
							: request.observation,
					),
					store: false,
					...(reasoningEffort ? { reasoning: { effort: reasoningEffort } } : {}),
					max_output_tokens: maxOutputTokens,
					text: {
						format: {
							type: 'json_schema',
							name: v2 ? 'hanabi_decision' : 'hanabi_action',
							strict: true,
							schema: decisionSchema(request, ownTileIds),
						},
					},
				},
				{ signal, timeout: timeoutMs, maxRetries: 0 },
			);
			if (signal.aborted) {
				throw new BotDecisionError(request.signal.aborted ? 'cancelled' : 'timeout');
			}
			if (response.status !== 'completed') throw new BotDecisionError('incomplete');
			if (
				response.output.some(
					(item) =>
						item.type === 'message' && item.content.some((content) => content.type === 'refusal'),
				)
			) {
				throw new BotDecisionError('refused');
			}
			let result: unknown;
			try {
				result = JSON.parse(response.output_text);
			} catch {
				throw new BotDecisionError('invalid_action');
			}
			if (!result || typeof result !== 'object' || Array.isArray(result)) {
				throw new BotDecisionError('invalid_action');
			}
			if (v2) {
				if (
					Object.keys(result).length !== (notepadEnabled ? 4 : 3) ||
					!isV2BotDecision(
						result,
						ownTileIds,
						request.observation.rules.allowDragging &&
							request.observation.stage === HanabiStage.Playing,
						opportunity,
						notepadEnabled,
					) ||
					(opportunity === 'turn' &&
						(typeof result.actionId !== 'string' || !actionIds.includes(result.actionId)))
				) {
					throw new BotDecisionError('invalid_action');
				}
				return {
					actionId: result.actionId,
					arrangement: result.arrangement,
					explanation: result.explanation,
					...(notepadEnabled ? { notes: result.notes } : {}),
					inputTokens: response.usage?.input_tokens,
					outputTokens: response.usage?.output_tokens,
				};
			}
			if (
				Object.keys(result).length !== 1 ||
				!('actionId' in result) ||
				typeof result.actionId !== 'string' ||
				!actionIds.includes(result.actionId)
			) {
				throw new BotDecisionError('invalid_action');
			}
			return {
				actionId: result.actionId,
				inputTokens: response.usage?.input_tokens,
				outputTokens: response.usage?.output_tokens,
			};
		} catch (error) {
			if (error instanceof BotDecisionError) throw error;
			if (request.signal.aborted) throw new BotDecisionError('cancelled');
			if (deadline.aborted || error instanceof OpenAI.APIConnectionTimeoutError) {
				throw new BotDecisionError('timeout');
			}
			if (error instanceof OpenAI.APIError) {
				if (error.status === 429) throw new BotDecisionError('rate_limit');
				if (error.status === 408 || error.status === 409 || (error.status ?? 0) >= 500) {
					throw new BotDecisionError('transient');
				}
				if (error.status !== undefined) throw new BotDecisionError('unavailable');
			}
			throw new BotDecisionError('transient');
		}
	}
}
