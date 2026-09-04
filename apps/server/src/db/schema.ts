import { index, integer, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import type { GameTranscriptV1 } from '../games/hanabi/GameTranscript.js';

export const gameTranscripts = pgTable(
	'game_transcripts',
	{
		roundId: text('round_id').primaryKey(),
		gameId: text('game_id').notNull(),
		gameCode: text('game_code').notNull(),
		revision: integer('revision').notNull(),
		integrity: text('integrity').notNull(),
		status: text('status').notNull(),
		startedAt: timestamp('started_at', { withTimezone: true }),
		finishedAt: timestamp('finished_at', { withTimezone: true }),
		transcript: jsonb('transcript').$type<GameTranscriptV1>().notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		index('game_transcripts_game_id_idx').on(table.gameId),
		index('game_transcripts_started_at_idx').on(table.startedAt),
	],
);
