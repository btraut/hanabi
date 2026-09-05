import { isBotPolicy, type BotPolicy } from './BotPolicy.js';
import { isBotHistory, type BotHistory } from './BotHistory.js';
import { isBotNotepads, type BotNotepad } from './BotNotepad.js';

export type BotFailureCode =
	| 'timeout'
	| 'unavailable'
	| 'rate_limit'
	| 'transient'
	| 'refused'
	| 'incomplete'
	| 'invalid_action'
	| 'busy'
	| 'global_budget'
	| 'round_budget'
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
	pendingClues?: Array<{ playerId: string; eventIds: string[] }>;
	notepads?: Record<string, BotNotepad>;
}

export const BOT_FAILURE_MESSAGES: Record<BotFailureCode, string> = {
	timeout: 'The bot took too long. Try its turn again.',
	unavailable:
		'The bot service is unavailable. The server operator may need to check its configuration.',
	rate_limit: 'The bot service is busy. Wait a moment, then try again.',
	transient: 'The bot could not reach its service. Try again.',
	refused: 'The bot did not choose an action. You can retry its turn.',
	incomplete: 'The bot did not finish choosing an action. You can retry its turn.',
	invalid_action: 'The bot returned an invalid action. No move was made; try again.',
	busy: 'Other bots are thinking. Wait a moment, then try again.',
	global_budget:
		'The server bot allowance is used up. Wait for its limit window to renew or ask the server operator.',
	round_budget:
		'This round has reached its bot allowance. Ask the server operator to raise it, or reset the game to start a new round.',
	save_failed: 'The game could not be saved. Try the bot turn again when storage is available.',
	input_too_large:
		'This round has too much history or notepad content for a bot request. The complete record is saved; start a new round to continue with bots.',
};

export function isBotRound(value: unknown): value is BotRound {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
	const round = value as Partial<BotRound>;
	const policy = round.policy;
	return (
		(round.version === 1 || round.version === 2) &&
		typeof round.roundId === 'string' &&
		isBotPolicy(policy) &&
		isBotHistory(round.history) &&
		(round.notepads === undefined ||
			(policy.notepadVersion === 1 && isBotNotepads(round.notepads))) &&
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
		(round.failure === undefined || Object.hasOwn(BOT_FAILURE_MESSAGES, round.failure))
	);
}
