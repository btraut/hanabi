import type { HanabiFinishedReason } from '@hanabi/shared';
import { count, desc, sql } from 'drizzle-orm';
import type { DatabaseConnection } from '../../db/database.js';
import { gameTranscripts } from '../../db/schema.js';
import type {
	GameTranscriptIntegrityStatus,
	GameTranscriptStatus,
	GameTranscriptV1,
} from './GameTranscript.js';

export const ADMIN_TRANSCRIPT_PAGE_SIZE = 25;

export interface AdminTranscriptSummary {
	roundId: string;
	gameCode: string;
	recordedAt: string;
	status: GameTranscriptStatus;
	integrity: GameTranscriptIntegrityStatus;
	playerNames: string[];
	moveCount: number;
	score: number | null;
	finishedReason: HanabiFinishedReason | null;
}

export interface AdminTranscriptSummaryPage {
	items: AdminTranscriptSummary[];
	page: number;
	pageSize: typeof ADMIN_TRANSCRIPT_PAGE_SIZE;
	total: number;
}

export interface GameTranscriptSummaryReader {
	list(page: number): Promise<AdminTranscriptSummaryPage>;
}

export default class PostgresGameTranscriptSummaryReader implements GameTranscriptSummaryReader {
	constructor(private readonly _db: DatabaseConnection['db']) {}

	public async list(page: number): Promise<AdminTranscriptSummaryPage> {
		const offset = (page - 1) * ADMIN_TRANSCRIPT_PAGE_SIZE;
		if (!Number.isSafeInteger(offset) || offset < 0) {
			throw new RangeError('Transcript page must be a positive safe integer.');
		}

		const itemQuery = this._db
			.select({
				roundId: gameTranscripts.roundId,
				gameCode: gameTranscripts.gameCode,
				startedAt: gameTranscripts.startedAt,
				createdAt: gameTranscripts.createdAt,
				status: gameTranscripts.status,
				integrity: gameTranscripts.integrity,
				players: sql<GameTranscriptV1['players']>`${gameTranscripts.transcript} -> 'players'`,
				moveCount: sql<number>`jsonb_array_length(${gameTranscripts.transcript} -> 'moves')`,
				score: sql<number | null>`(${gameTranscripts.transcript} -> 'result' ->> 'score')::integer`,
				finishedReason: sql<HanabiFinishedReason | null>`${gameTranscripts.transcript} -> 'result' ->> 'finishedReason'`,
			})
			.from(gameTranscripts)
			.orderBy(
				desc(sql`coalesce(${gameTranscripts.startedAt}, ${gameTranscripts.createdAt})`),
				desc(gameTranscripts.roundId),
			)
			.limit(ADMIN_TRANSCRIPT_PAGE_SIZE)
			.offset(offset);
		const totalQuery = this._db.select({ total: count() }).from(gameTranscripts);
		const [rows, [totalRow]] = await Promise.all([itemQuery, totalQuery]);

		return {
			items: rows.map((row) => ({
				roundId: row.roundId,
				gameCode: row.gameCode,
				recordedAt: (row.startedAt ?? row.createdAt).toISOString(),
				status: row.status as GameTranscriptStatus,
				integrity: row.integrity as GameTranscriptIntegrityStatus,
				playerNames: row.players.map(({ name }) => name),
				moveCount: row.moveCount,
				score: row.score,
				finishedReason: row.finishedReason,
			})),
			page,
			pageSize: ADMIN_TRANSCRIPT_PAGE_SIZE,
			total: totalRow?.total ?? 0,
		};
	}
}
