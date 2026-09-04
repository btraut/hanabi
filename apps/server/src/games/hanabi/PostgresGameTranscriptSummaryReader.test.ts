import { describe, expect, it, vi } from 'vitest';
import type { DatabaseConnection } from '../../db/database.js';
import PostgresGameTranscriptSummaryReader, {
	ADMIN_TRANSCRIPT_PAGE_SIZE,
} from './PostgresGameTranscriptSummaryReader.js';

describe('PostgresGameTranscriptSummaryReader', () => {
	it('returns the requested fixed-size offset page without loading full transcripts', async () => {
		const rows = [
			{
				roundId: 'round-2',
				gameCode: 'ABCDEF',
				startedAt: new Date('2026-09-03T10:00:00.000Z'),
				status: 'finished',
				integrity: 'complete',
				players: [
					{ id: 'player-a', name: 'Alice' },
					{ id: 'player-b', name: 'Bob' },
				],
				moveCount: 18,
				score: 12,
				finishedReason: 'OutOfTurns',
			},
		];
		const offset = vi.fn().mockResolvedValue(rows);
		const limit = vi.fn().mockReturnValue({ offset });
		const orderBy = vi.fn().mockReturnValue({ limit });
		const itemFrom = vi.fn().mockReturnValue({ orderBy });
		const totalFrom = vi.fn().mockResolvedValue([{ total: 30 }]);
		const select = vi
			.fn()
			.mockReturnValueOnce({ from: itemFrom })
			.mockReturnValueOnce({ from: totalFrom });
		const db = { select } as unknown as DatabaseConnection['db'];
		const reader = new PostgresGameTranscriptSummaryReader(db);

		await expect(reader.list(2)).resolves.toEqual({
			items: [
				{
					roundId: 'round-2',
					gameCode: 'ABCDEF',
					startedAt: '2026-09-03T10:00:00.000Z',
					status: 'finished',
					integrity: 'complete',
					playerNames: ['Alice', 'Bob'],
					moveCount: 18,
					score: 12,
					finishedReason: 'OutOfTurns',
				},
			],
			page: 2,
			pageSize: 25,
			total: 30,
		});
		expect(limit).toHaveBeenCalledWith(ADMIN_TRANSCRIPT_PAGE_SIZE);
		expect(offset).toHaveBeenCalledWith(ADMIN_TRANSCRIPT_PAGE_SIZE);
	});

	it('rejects page numbers whose offset cannot be represented safely', async () => {
		const reader = new PostgresGameTranscriptSummaryReader({} as DatabaseConnection['db']);

		await expect(reader.list(Number.MAX_SAFE_INTEGER)).rejects.toThrow(RangeError);
	});
});
