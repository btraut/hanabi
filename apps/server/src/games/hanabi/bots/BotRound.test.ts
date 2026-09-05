import { generateHanabiGameData } from '@hanabi/shared';
import { describe, expect, it } from 'vitest';
import { createBotHistory } from './BotHistory.js';
import { createBotPolicy, createRoundBotPolicy } from './BotPolicy.js';
import { isBotRound, type BotRound } from './BotRound.js';

function fixture(): BotRound {
	const data = generateHanabiGameData();
	return {
		version: 2,
		roundId: data.seed,
		policy: createRoundBotPolicy(createBotPolicy('test-model', 'Test conventions'), data),
		history: createBotHistory(data, 2),
		revision: 0,
		attempts: 0,
		tokens: 0,
		status: 'ready',
		lastAttemptAt: 0,
		pendingClues: [],
	};
}

describe('pending result queues', () => {
	it('accepts independent bot results and legacy singular results', () => {
		const round = fixture();
		expect(isBotRound(round)).toBe(true);
		expect(isBotRound({ ...round, pendingResults: [] })).toBe(true);
		expect(
			isBotRound({
				...round,
				pendingResults: [
					{ playerId: 'bot:one', eventId: 'event-1' },
					{ playerId: 'bot:two', eventId: 'event-2' },
				],
			}),
		).toBe(true);
		expect(isBotRound({ ...round, pendingResult: { playerId: 'bot', eventId: 'event-1' } })).toBe(
			true,
		);
	});

	it('rejects malformed queues, duplicate seats, duplicate events, and overfull queues', () => {
		for (const pendingResults of [
			null,
			{},
			[null],
			[{}],
			[{ playerId: '', eventId: 'event-1' }],
			[{ playerId: 'bot', eventId: '' }],
			[
				{ playerId: 'bot', eventId: 'event-1' },
				{ playerId: 'bot', eventId: 'event-2' },
			],
			[
				{ playerId: 'bot:one', eventId: 'event-1' },
				{ playerId: 'bot:two', eventId: 'event-1' },
			],
			Array.from({ length: 6 }, (_, index) => ({
				playerId: `bot:${index}`,
				eventId: `event-${index}`,
			})),
		]) {
			expect(isBotRound({ ...fixture(), pendingResults })).toBe(false);
		}
	});

	it('rejects mixed singular and plural result representations', () => {
		expect(
			isBotRound({
				...fixture(),
				pendingResult: { playerId: 'bot:one', eventId: 'event-1' },
				pendingResults: [{ playerId: 'bot:two', eventId: 'event-2' }],
			}),
		).toBe(false);
	});

	it('rejects result queues for legacy contracts', () => {
		const round = fixture();
		round.version = 1;
		round.policy = createBotPolicy('test-model', 'Test conventions');
		round.history = createBotHistory(generateHanabiGameData());
		expect(isBotRound(round)).toBe(true);
		expect(isBotRound({ ...round, pendingResults: [] })).toBe(false);
	});
});
