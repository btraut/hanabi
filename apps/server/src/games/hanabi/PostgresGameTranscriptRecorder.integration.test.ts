import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { createDatabaseConnection } from '../../db/database.js';
import { gameTranscripts } from '../../db/schema.js';
import { GameTranscriptV1 } from './GameTranscript.js';
import PostgresGameTranscriptRecorder from './PostgresGameTranscriptRecorder.js';

const databaseUrl = process.env.TEST_DATABASE_URL;

describe.runIf(databaseUrl)('PostgresGameTranscriptRecorder integration', () => {
	it('inserts and advances a transcript in a real Postgres database', async () => {
		const roundId = `integration-${randomUUID()}`;
		const startedAt = new Date().toISOString();
		const started: GameTranscriptV1 = {
			version: 1,
			revision: 1,
			roundId,
			gameId: 'integration-game',
			gameCode: 'VERIFY',
			rules: {
				ruleSet: '5-color',
				criticalGameOver: true,
				allowDragging: true,
				showNotes: true,
			},
			players: [{ id: 'alice', name: 'Alice' }],
			dealOrder: [{ playerId: 'alice', tileIds: ['red-1'] }],
			turnOrder: ['alice'],
			deck: [{ id: 'red-1', color: 'red', number: 1 }],
			moves: [],
			lifecycle: {
				status: 'in_progress',
				startedAt,
				updatedAt: startedAt,
				endedAt: null,
			},
			integrity: { status: 'complete' },
		};

		const firstRecorder = new PostgresGameTranscriptRecorder(
			createDatabaseConnection(databaseUrl!),
		);
		firstRecorder.record(started);
		await firstRecorder.close();

		const resetAt = new Date().toISOString();
		const reset: GameTranscriptV1 = {
			...started,
			revision: 2,
			lifecycle: {
				...started.lifecycle,
				status: 'reset',
				updatedAt: resetAt,
				endedAt: resetAt,
			},
		};
		const secondRecorder = new PostgresGameTranscriptRecorder(
			createDatabaseConnection(databaseUrl!),
		);
		secondRecorder.record(reset);
		await secondRecorder.close();

		const verification = createDatabaseConnection(databaseUrl!);
		try {
			const [row] = await verification.db
				.select()
				.from(gameTranscripts)
				.where(eq(gameTranscripts.roundId, roundId));
			expect(row).toMatchObject({
				revision: 2,
				status: 'reset',
				integrity: 'complete',
				transcript: {
					roundId,
					players: [{ id: 'alice', name: 'Alice' }],
					deck: [{ id: 'red-1', color: 'red', number: 1 }],
					lifecycle: { status: 'reset' },
				},
			});
		} finally {
			await verification.db.delete(gameTranscripts).where(eq(gameTranscripts.roundId, roundId));
			await verification.close();
		}
	});
});
