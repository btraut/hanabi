import type { BotDecisionRequest } from './OpenAiBot.js';

export const MAX_BOT_INPUT_BYTES = 512_000;

/** Server-only checkpoint of the last accepted response for one seat in one round. */
export interface BotConversation {
	responseId: string;
	roundId: string;
	playerId: string;
	policyHash: string;
	historyLength: number;
	lastEventId: string | null;
}

export function isBotConversation(value: unknown): value is BotConversation {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
	const state = value as Partial<BotConversation>;
	return (
		[state.responseId, state.roundId, state.playerId, state.policyHash].every(
			(value) => typeof value === 'string' && value.length > 0 && value.length <= 256,
		) &&
		typeof state.historyLength === 'number' &&
		Number.isSafeInteger(state.historyLength) &&
		state.historyLength >= 0 &&
		(state.lastEventId === null ||
			(typeof state.lastEventId === 'string' && state.lastEventId.length > 0))
	);
}

export function conversationCheckpoint(
	request: BotDecisionRequest,
	responseId: string,
): BotConversation {
	const history = request.observation.history;
	const ids =
		'events' in history
			? history.events.map(({ eventId }) => eventId)
			: history.moves.map(({ actionId }) => actionId);
	return {
		responseId,
		roundId: request.roundId!,
		playerId: request.observation.playerId,
		policyHash: request.policy.hash,
		historyLength: ids.length,
		lastEventId: ids.at(-1) ?? null,
	};
}

export function botConversationInstructions(request: BotDecisionRequest): string {
	// Saved policies keep their identity; update only the transport-specific directions.
	const instructions = request.policy.instructions
		.replace(
			'Treat each request independently, using the provided public history rather than remembering private context from another seat.',
			'Use the conversation history for this seat and round.',
		)
		.replace(
			'Treat each request independently and use the supplied full public event history.',
			'Use the conversation history for this seat and round.',
		);
	return `${instructions}\n\n## Conversation protocol\n\nThis conversation belongs only to this bot seat in this round. Retain earlier observations and explanations. The initial message supplies recorded public history. Follow-up messages supply the current player-visible board and only new public history events or moves since the previous accepted response; append these to the history already in this conversation. Rules and board-coordinate definitions remain those in the initial message. Current observations and public events are authoritative; your prior explanations are revisable beliefs, not facts. A prior response is an accepted decision, but its actual outcome is established only by subsequent public events. Use only the latest legalActions; their IDs may be reused for different actions. Never repeat an earlier action just because it was accepted. No other seat's private conversation is available.`;
}

/** Assemble only the new user message; all data is already projected through BotObservation. */
export function prepareBotInput(request: BotDecisionRequest): {
	input: string;
	conversation?: BotConversation;
} {
	const { observation } = request;
	const history = observation.history;
	const ids =
		'events' in history
			? history.events.map(({ eventId }) => eventId)
			: history.moves.map(({ actionId }) => actionId);
	const prior = request.conversation;
	const conversation =
		request.roundId &&
		isBotConversation(prior) &&
		prior.roundId === request.roundId &&
		prior.playerId === observation.playerId &&
		prior.policyHash === request.policy.hash &&
		prior.historyLength <= ids.length &&
		prior.lastEventId === (ids[prior.historyLength - 1] ?? null)
			? prior
			: undefined;
	const opportunity = request.opportunity ?? 'turn';
	const { rules, board, ...current } = observation;
	const payload = {
		...(conversation ? current : observation),
		...(conversation
			? {
					history:
						'events' in history
							? { events: history.events.slice(conversation.historyLength) }
							: { moves: history.moves.slice(conversation.historyLength) },
				}
			: { rules, board }),
		...(request.policy.contractVersion === 2
			? {
					...(opportunity !== 'turn' ? { legalActions: [] } : {}),
					decisionContext: {
						opportunity,
						sourceClueEventIds: opportunity === 'result' ? [] : (request.sourceClueEventIds ?? []),
						...(opportunity === 'result'
							? { sourceActionEventId: request.sourceActionEventId }
							: {}),
					},
				}
			: {}),
	};
	return { input: JSON.stringify(payload), conversation };
}

export function botInputBytes(
	request: BotDecisionRequest,
	prepared = prepareBotInput(request),
): number {
	return Buffer.byteLength(
		prepared.input +
			(request.roundId
				? prepared.conversation
					? ''
					: botConversationInstructions(request)
				: request.policy.instructions),
		'utf8',
	);
}
