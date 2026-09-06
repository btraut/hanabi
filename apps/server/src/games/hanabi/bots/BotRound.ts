import { isBotPolicy, migrateBotPolicy, type BotPolicy } from './BotPolicy.js';
import { isBotHistory, type BotHistory } from './BotHistory.js';
import { isBotConversation, type BotConversation } from './BotConversation.js';

export type BotFailureCode =
	| 'timeout'
	| 'unavailable'
	| 'rate_limit'
	| 'transient'
	| 'refused'
	| 'incomplete'
	| 'invalid_action'
	| 'busy'
	| 'global_budget' // Accepted only when loading legacy snapshots; cleared during restoration.
	| 'round_budget' // Accepted only when loading legacy snapshots; cleared during restoration.
	| 'save_failed'
	| 'input_too_large';

export interface BotRound {
	version: 1 | 2;
	roundId: string;
	policy: BotPolicy;
	history: BotHistory;
	revision: number;
	attempts: number;
	tokens: number;
	status: 'ready' | 'thinking' | 'error' | 'exhausted';
	failure?: BotFailureCode;
	lastAttemptAt: number;
	requiredTokens?: number;
	pendingResult?: { playerId: string; eventId: string };
	pendingResults?: Array<{ playerId: string; eventId: string }>;
	pendingClues?: Array<{ playerId: string; eventIds: string[] }>;
	conversations?: Record<string, BotConversation>;
}

export const BOT_FAILURE_MESSAGES: Record<
	Exclude<BotFailureCode, 'round_budget' | 'global_budget'>,
	string
> = {
	timeout: 'The bot request timed out. Retrying automatically.',
	unavailable:
		'The bot service is unavailable. Retrying automatically; the server configuration may need attention.',
	rate_limit: 'The bot service is busy. Retrying automatically.',
	transient: 'The bot could not reach its service. Retrying automatically.',
	refused: 'The bot did not choose an action. Retrying automatically.',
	incomplete: 'The bot did not finish choosing an action. Retrying automatically.',
	invalid_action: 'The bot returned an invalid action. No move was made. Retrying automatically.',
	busy: 'Other bots are thinking. Retrying automatically.',
	save_failed: 'The game could not be saved. Retrying automatically when storage is available.',
	input_too_large:
		'The bot request exceeds the input limit. The complete record is saved; server attention is required.',
};

export function isBotRound(value: unknown): value is BotRound {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
	const round = value as Partial<BotRound>;
	const policy = round.policy;
	const isPendingResult = (pending: unknown): pending is NonNullable<BotRound['pendingResult']> => {
		if (!pending || typeof pending !== 'object' || Array.isArray(pending)) return false;
		const result = pending as Partial<NonNullable<BotRound['pendingResult']>>;
		return (
			typeof result.playerId === 'string' &&
			result.playerId.length > 0 &&
			typeof result.eventId === 'string' &&
			result.eventId.length > 0
		);
	};
	return (
		(round.version === 1 || round.version === 2) &&
		typeof round.roundId === 'string' &&
		isBotPolicy(policy) &&
		isBotHistory(round.history) &&
		(round.conversations === undefined ||
			(round.conversations !== null &&
				typeof round.conversations === 'object' &&
				!Array.isArray(round.conversations) &&
				Object.entries(round.conversations).every(([playerId, conversation]) => {
					if (!isBotConversation(conversation) || !round.history) return false;
					const events = round.history.version === 2 ? round.history.events : round.history.moves;
					const lastEvent = events[conversation.historyLength - 1];
					return (
						conversation.playerId === playerId &&
						conversation.roundId === round.roundId &&
						conversation.policyHash === policy.hash &&
						conversation.historyLength <= events.length &&
						conversation.lastEventId ===
							(lastEvent ? ('eventId' in lastEvent ? lastEvent.eventId : lastEvent.actionId) : null)
					);
				}))) &&
		(round.pendingResult === undefined || round.pendingResults === undefined) &&
		(round.pendingResult === undefined ||
			(round.version === 2 &&
				policy.reflectionAfterAction === true &&
				isPendingResult(round.pendingResult))) &&
		(round.pendingResults === undefined ||
			(round.version === 2 &&
				policy.reflectionAfterAction === true &&
				Array.isArray(round.pendingResults) &&
				round.pendingResults.length <= 5 &&
				round.pendingResults.every(isPendingResult) &&
				new Set(round.pendingResults.map((pending) => pending.playerId)).size ===
					round.pendingResults.length &&
				new Set(round.pendingResults.map((pending) => pending.eventId)).size ===
					round.pendingResults.length)) &&
		(round.version === 2
			? policy.contractVersion === 2 &&
				round.history.version === 2 &&
				Array.isArray(round.pendingClues) &&
				round.pendingClues.length <= 5 &&
				round.pendingClues.every(
					(pending) =>
						pending &&
						typeof pending.playerId === 'string' &&
						Array.isArray(pending.eventIds) &&
						pending.eventIds.length > 0 &&
						new Set(pending.eventIds).size === pending.eventIds.length &&
						pending.eventIds.every((id) => typeof id === 'string' && id.length > 0),
				) &&
				new Set(round.pendingClues.map((pending) => pending.playerId)).size ===
					round.pendingClues.length
			: policy.contractVersion === undefined && round.history.version === 1) &&
		[round.revision, round.attempts, round.tokens, round.lastAttemptAt].every(
			(n) => typeof n === 'number' && Number.isSafeInteger(n) && n >= 0,
		) &&
		['ready', 'thinking', 'error', 'exhausted'].includes(round.status ?? '') &&
		(round.requiredTokens === undefined ||
			(Number.isSafeInteger(round.requiredTokens) && round.requiredTokens >= 0)) &&
		(round.failure === undefined ||
			round.failure === 'round_budget' ||
			round.failure === 'global_budget' ||
			Object.hasOwn(BOT_FAILURE_MESSAGES, round.failure))
	);
}

/** Discard retired private notes and reset conversations that contain the old response contract. */
export function removeBotScratchpad(round: BotRound): BotRound {
	const { notepads, ...retained } = round as BotRound & { notepads?: unknown };
	const policy = migrateBotPolicy(round.policy);
	if (policy === round.policy && notepads === undefined) return retained;
	const { conversations: _conversations, ...withoutConversations } = retained;
	return { ...withoutConversations, policy };
}
