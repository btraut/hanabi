import { eq } from 'drizzle-orm';
import { isDeepStrictEqual } from 'node:util';
import { DatabaseConnection } from '../../db/database.js';
import { gameTranscripts } from '../../db/schema.js';
import Logger from '../../utils/Logger.js';
import { GameTranscriptSnapshot, GameTranscriptV1 } from './GameTranscript.js';
import { GameTranscriptRecorder } from './GameTranscriptRecorder.js';

export const MAX_PENDING_TRANSCRIPT_ROUNDS = 1_000;
export const DEFAULT_TRANSCRIPT_WRITE_ATTEMPTS = 3;
export const MAX_RECORDED_TRANSCRIPT_ERRORS = 100;

function moveHistoryIsPrefix(
	prefix: GameTranscriptSnapshot['moves'],
	candidate: GameTranscriptSnapshot['moves'],
): boolean {
	return (
		prefix.length <= candidate.length &&
		prefix.every((move, index) => isDeepStrictEqual(move, candidate[index]))
	);
}

function databaseErrorCode(error: unknown): string {
	if (typeof error === 'object' && error !== null && 'code' in error) {
		const code = (error as { code?: unknown }).code;
		if (typeof code === 'string' && /^[A-Z0-9_]{2,32}$/i.test(code)) return code;
	}
	return error instanceof Error ? error.name : 'UNKNOWN_DATABASE_ERROR';
}

function conflictedTranscript(existing: GameTranscriptV1, reason: string): GameTranscriptV1 {
	if (existing.integrity.status === 'conflicted') return existing;
	return {
		...existing,
		integrity: { status: 'conflicted', reason },
	};
}

interface ExistingTranscriptRow {
	revision: number;
	transcript: GameTranscriptV1;
}

export type TranscriptReconciliation =
	| { action: 'ignore' }
	| { action: 'write'; transcript: GameTranscriptV1 }
	| { action: 'conflict'; transcript: GameTranscriptV1 };

function mutableTranscript(snapshot: GameTranscriptSnapshot): GameTranscriptV1 {
	return structuredClone(snapshot) as GameTranscriptV1;
}

function replayDefinition(transcript: GameTranscriptSnapshot) {
	return {
		version: transcript.version,
		roundId: transcript.roundId,
		gameId: transcript.gameId,
		gameCode: transcript.gameCode,
		rules: transcript.rules,
		players: transcript.players,
		dealOrder: transcript.dealOrder,
		turnOrder: transcript.turnOrder,
		deck: transcript.deck,
	};
}

export function reconcileTranscriptSnapshot(
	existingRow: ExistingTranscriptRow | undefined,
	snapshot: GameTranscriptSnapshot,
): TranscriptReconciliation {
	const incoming = mutableTranscript(snapshot);
	if (!existingRow) return { action: 'write', transcript: incoming };
	if (existingRow.revision > snapshot.revision) return { action: 'ignore' };

	const existing = existingRow.transcript;
	if (existingRow.revision === snapshot.revision) {
		return isDeepStrictEqual(existing, snapshot)
			? { action: 'ignore' }
			: {
					action: 'conflict',
					transcript: conflictedTranscript(
						existing,
						`Incoming revision ${snapshot.revision} differed from the durable revision with the same number.`,
					),
				};
	}

	if (
		!isDeepStrictEqual(replayDefinition(existing), replayDefinition(snapshot)) ||
		!moveHistoryIsPrefix(existing.moves, snapshot.moves)
	) {
		return {
			action: 'conflict',
			transcript: conflictedTranscript(
				existing,
				`Incoming revision ${snapshot.revision} diverged from durable revision ${existingRow.revision}.`,
			),
		};
	}

	if (existing.integrity.status === 'conflicted') {
		incoming.integrity = existing.integrity;
	}
	return { action: 'write', transcript: incoming };
}

export default class PostgresGameTranscriptRecorder implements GameTranscriptRecorder {
	private readonly _pending = new Map<string, GameTranscriptSnapshot>();
	private _worker: Promise<void> | null = null;
	private _closing = false;
	private _errors: Error[] = [];
	private _suppressedErrorCount = 0;

	constructor(
		private readonly _connection: DatabaseConnection,
		private readonly _maxPendingRounds = MAX_PENDING_TRANSCRIPT_ROUNDS,
		private readonly _maxWriteAttempts = DEFAULT_TRANSCRIPT_WRITE_ATTEMPTS,
	) {
		if (!Number.isInteger(_maxPendingRounds) || _maxPendingRounds < 1) {
			throw new RangeError('Transcript recorder requires at least one pending-round slot.');
		}
		if (!Number.isInteger(_maxWriteAttempts) || _maxWriteAttempts < 1) {
			throw new RangeError('Transcript recorder requires at least one write attempt.');
		}
	}

	public record(snapshot: GameTranscriptSnapshot): void {
		if (this._closing) return;

		const existing = this._pending.get(snapshot.roundId);
		if (existing && existing.revision > snapshot.revision) return;
		if (existing && existing.revision === snapshot.revision) {
			if (isDeepStrictEqual(existing, snapshot)) return;
			this._pending.set(
				snapshot.roundId,
				conflictedTranscript(
					mutableTranscript(existing),
					`Queued revision ${snapshot.revision} received divergent snapshots.`,
				),
			);
			return;
		}

		if (!existing && this._pending.size >= this._maxPendingRounds) {
			const oldestRoundId = this._pending.keys().next().value;
			if (typeof oldestRoundId === 'string') {
				this._pending.delete(oldestRoundId);
				const overflow = new Error(
					`Transcript queue reached ${this._maxPendingRounds} pending rounds; dropped round ${oldestRoundId}.`,
				);
				this._recordError(overflow);
				Logger.error(overflow.message);
			}
		}

		this._pending.set(snapshot.roundId, structuredClone(snapshot));
		this._startWorker();
	}

	private _recordError(error: Error): void {
		if (this._errors.length < MAX_RECORDED_TRANSCRIPT_ERRORS) {
			this._errors.push(error);
		} else {
			this._suppressedErrorCount += 1;
		}
	}

	private _startWorker(): void {
		if (this._worker) return;
		this._worker = this._drain().finally(() => {
			this._worker = null;
			if (this._pending.size > 0) this._startWorker();
		});
	}

	private async _drain(): Promise<void> {
		while (this._pending.size > 0) {
			const next = this._pending.entries().next().value;
			if (!next) return;
			const [roundId, snapshot] = next;
			this._pending.delete(roundId);

			try {
				await this._writeWithRetry(snapshot);
			} catch (error) {
				const code = databaseErrorCode(error);
				const sanitized = new Error(
					`Transcript write failed for game ${snapshot.gameId}, round ${snapshot.roundId} (${code}).`,
				);
				this._recordError(sanitized);
				Logger.error(sanitized.message);
			}
		}
	}

	private async _writeWithRetry(snapshot: GameTranscriptSnapshot): Promise<void> {
		let lastError: unknown;
		for (let attempt = 1; attempt <= this._maxWriteAttempts; attempt += 1) {
			try {
				await this.writeSnapshot(snapshot);
				return;
			} catch (error) {
				lastError = error;
			}
		}
		throw lastError;
	}

	protected async writeSnapshot(snapshot: GameTranscriptSnapshot): Promise<void> {
		await this._connection.db.transaction(async (transaction) => {
			const [existingRow] = await transaction
				.select({ revision: gameTranscripts.revision, transcript: gameTranscripts.transcript })
				.from(gameTranscripts)
				.where(eq(gameTranscripts.roundId, snapshot.roundId))
				.for('update');

			const reconciliation = reconcileTranscriptSnapshot(existingRow, snapshot);
			if (!existingRow) {
				if (reconciliation.action !== 'write') {
					throw new Error('A missing transcript row must produce an insert.');
				}
				await transaction.insert(gameTranscripts).values(this._rowFor(reconciliation.transcript));
				return;
			}

			if (reconciliation.action === 'ignore') return;
			if (reconciliation.action === 'conflict') {
				const { transcript } = reconciliation;
				await transaction
					.update(gameTranscripts)
					.set({
						integrity: transcript.integrity.status,
						transcript,
						updatedAt: new Date(),
					})
					.where(eq(gameTranscripts.roundId, snapshot.roundId));
				return;
			}

			await transaction
				.update(gameTranscripts)
				.set(this._rowFor(reconciliation.transcript))
				.where(eq(gameTranscripts.roundId, snapshot.roundId));
		});
	}

	private _rowFor(snapshot: GameTranscriptSnapshot) {
		return {
			roundId: snapshot.roundId,
			gameId: snapshot.gameId,
			gameCode: snapshot.gameCode,
			revision: snapshot.revision,
			integrity: snapshot.integrity.status,
			status: snapshot.lifecycle.status,
			startedAt: snapshot.lifecycle.startedAt ? new Date(snapshot.lifecycle.startedAt) : null,
			finishedAt: snapshot.lifecycle.endedAt ? new Date(snapshot.lifecycle.endedAt) : null,
			transcript: mutableTranscript(snapshot),
			updatedAt: new Date(),
		};
	}

	public async close(): Promise<void> {
		if (this._closing) return;
		this._closing = true;
		if (this._pending.size > 0) this._startWorker();
		if (this._worker) await this._worker;

		try {
			await this._connection.close();
		} catch (error) {
			this._recordError(
				new Error(`Transcript database close failed (${databaseErrorCode(error)}).`),
			);
		}

		if (this._errors.length > 0 || this._suppressedErrorCount > 0) {
			const errors = this._errors;
			if (this._suppressedErrorCount > 0) {
				errors.push(
					new Error(
						`${this._suppressedErrorCount} additional transcript persistence failures were suppressed.`,
					),
				);
			}
			this._errors = [];
			this._suppressedErrorCount = 0;
			throw new AggregateError(errors, 'Game transcript persistence reported failures.');
		}
	}
}
