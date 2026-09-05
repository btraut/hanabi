import { describe, expect, it, vi } from 'vitest';
import { DatabaseConnection } from '../../db/database.js';
import { GameTranscriptSnapshot, GameTranscriptV1 } from './GameTranscript.js';
import PostgresGameTranscriptRecorder, {
	MAX_RECORDED_TRANSCRIPT_ERRORS,
	reconcileTranscriptSnapshot,
} from './PostgresGameTranscriptRecorder.js';

function deferred<T = void>() {
	let resolve!: (value: T | PromiseLike<T>) => void;
	let reject!: (reason?: unknown) => void;
	const promise = new Promise<T>((resolvePromise, rejectPromise) => {
		resolve = resolvePromise;
		reject = rejectPromise;
	});
	return { promise, resolve, reject };
}

function snapshot(roundId: string, revision: number, actionIds: string[] = []): GameTranscriptV1 {
	return {
		version: 1,
		revision,
		roundId,
		gameId: `game-${roundId}`,
		gameCode: 'ABCDEF',
		rules: {
			ruleSet: '5-color',
			criticalGameOver: true,
			allowDragging: true,
			showNotes: true,
		},
		players: [
			{ id: 'alice', name: 'Alice' },
			{ id: 'bob', name: 'Bob' },
		],
		dealOrder: [
			{ playerId: 'alice', tileIds: [] },
			{ playerId: 'bob', tileIds: [] },
		],
		turnOrder: ['alice', 'bob'],
		deck: [],
		moves: actionIds.map((actionId, index) => ({
			type: 'discard',
			actionId,
			index,
			createdAt: `2026-09-02T04:00:0${index + 1}.000Z`,
			actorId: index % 2 === 0 ? 'alice' : 'bob',
			tileId: `tile-${index}`,
			postTurn: {
				nextPlayerId: index % 2 === 0 ? 'bob' : 'alice',
				clues: 8,
				lives: 3,
				remainingTurns: null,
				score: 0,
				status: 'in_progress',
			},
		})),
		lifecycle: {
			status: 'in_progress',
			startedAt: '2026-09-02T04:00:00.000Z',
			updatedAt: `2026-09-02T04:00:${String(revision).padStart(2, '0')}.000Z`,
			endedAt: null,
		},
		integrity: { status: 'complete' },
	};
}

function fakeConnection() {
	const close = vi.fn().mockResolvedValue(undefined);
	const connection = { close } as unknown as DatabaseConnection;
	return { connection, close };
}

class TestRecorder extends PostgresGameTranscriptRecorder {
	constructor(
		connection: DatabaseConnection,
		private readonly _write: (snapshot: GameTranscriptSnapshot) => Promise<void>,
		maxPendingRounds = 1_000,
		maxWriteAttempts = 3,
	) {
		super(connection, maxPendingRounds, maxWriteAttempts);
	}

	protected override async writeSnapshot(snapshot: GameTranscriptSnapshot): Promise<void> {
		await this._write(snapshot);
	}
}

describe('PostgresGameTranscriptRecorder queue', () => {
	it('coalesces a busy round to its newest pending full snapshot', async () => {
		const { connection, close } = fakeConnection();
		const firstWriteStarted = deferred();
		const releaseFirstWrite = deferred();
		const writes: GameTranscriptSnapshot[] = [];
		const recorder = new TestRecorder(connection, async (value) => {
			writes.push(value);
			if (writes.length === 1) {
				firstWriteStarted.resolve();
				await releaseFirstWrite.promise;
			}
		});

		recorder.record(snapshot('round-1', 1));
		await firstWriteStarted.promise;
		recorder.record(snapshot('round-1', 2, ['move-1']));
		recorder.record(snapshot('round-1', 3, ['move-1', 'move-2']));
		releaseFirstWrite.resolve();
		await recorder.close();

		expect(writes.map(({ revision }) => revision)).toEqual([1, 3]);
		expect(close).toHaveBeenCalledOnce();
	});

	it('isolates exhausted write failures, continues other rounds, and reports them on close', async () => {
		const { connection, close } = fakeConnection();
		const attempts: string[] = [];
		const recorder = new TestRecorder(connection, (value) => {
			attempts.push(value.roundId);
			if (value.roundId === 'bad') {
				return Promise.reject(
					Object.assign(new Error('contains private database details'), { code: 'ETIMEDOUT' }),
				);
			}
			return Promise.resolve();
		});

		expect(() => recorder.record(snapshot('bad', 1))).not.toThrow();
		expect(() => recorder.record(snapshot('good', 1))).not.toThrow();
		const closeResult = recorder.close();

		await expect(closeResult).rejects.toMatchObject({
			message: 'Game transcript persistence reported failures.',
			errors: [
				{
					message: 'Transcript write failed for game game-bad, round bad (ETIMEDOUT).',
				},
			],
		});
		expect(attempts).toEqual(['bad', 'bad', 'bad', 'good']);
		expect(close).toHaveBeenCalledOnce();
	});

	it('sanitizes and reports database connection close failures', async () => {
		const close = vi
			.fn()
			.mockRejectedValue(
				Object.assign(new Error('postgres://private-credentials'), { code: '57P01' }),
			);
		const connection = { close } as unknown as DatabaseConnection;
		const recorder = new TestRecorder(connection, () => Promise.resolve());

		await expect(recorder.close()).rejects.toMatchObject({
			errors: [{ message: 'Transcript database close failed (57P01).' }],
		});
		expect(close).toHaveBeenCalledOnce();
	});

	it('bounds pending rounds, drops the oldest pending round, and reports overflow on close', async () => {
		const { connection } = fakeConnection();
		const firstWriteStarted = deferred();
		const releaseFirstWrite = deferred();
		const writes: string[] = [];
		const recorder = new TestRecorder(
			connection,
			async (value) => {
				writes.push(value.roundId);
				if (writes.length === 1) {
					firstWriteStarted.resolve();
					await releaseFirstWrite.promise;
				}
			},
			1,
			1,
		);

		recorder.record(snapshot('writing', 1));
		await firstWriteStarted.promise;
		recorder.record(snapshot('dropped', 1));
		recorder.record(snapshot('retained', 1));
		releaseFirstWrite.resolve();

		await expect(recorder.close()).rejects.toMatchObject({
			errors: [
				{
					message: 'Transcript queue reached 1 pending rounds; dropped round dropped.',
				},
			],
		});
		expect(writes).toEqual(['writing', 'retained']);
	});

	it('bounds accumulated error details during a prolonged outage', async () => {
		const { connection } = fakeConnection();
		const firstWriteStarted = deferred();
		const releaseFirstWrite = deferred();
		const recorder = new TestRecorder(
			connection,
			async (value) => {
				if (value.roundId === 'writing') {
					firstWriteStarted.resolve();
					await releaseFirstWrite.promise;
				}
			},
			1,
			1,
		);

		recorder.record(snapshot('writing', 1));
		await firstWriteStarted.promise;
		for (let index = 0; index < MAX_RECORDED_TRANSCRIPT_ERRORS + 5; index += 1) {
			recorder.record(snapshot(`overflow-${index}`, 1));
		}
		releaseFirstWrite.resolve();

		let failure: unknown;
		try {
			await recorder.close();
		} catch (error) {
			failure = error;
		}
		expect(failure).toBeInstanceOf(AggregateError);
		const errors = (failure as { errors: Error[] }).errors;
		expect(errors).toHaveLength(MAX_RECORDED_TRANSCRIPT_ERRORS + 1);
		expect(errors.at(-1)?.message).toBe(
			'4 additional transcript persistence failures were suppressed.',
		);
	});
});

describe('reconcileTranscriptSnapshot', () => {
	it('persists movement-only revisions and rejects rewrites or missing movement history', () => {
		const durable = snapshot('round-1', 2, ['move-1']);
		durable.handMovements = [
			{
				type: 'reposition',
				id: 'drag-1',
				createdAt: '2026-09-02T04:00:00.000Z',
				actorId: 'alice',
				afterMoveIndex: 0,
				positions: { tile: { x: 1, y: 1, z: 1 } },
			},
		];
		const incoming = structuredClone(durable);
		incoming.revision += 1;
		incoming.handMovements!.push({
			...incoming.handMovements![0],
			id: 'drag-2',
			afterMoveIndex: 1,
			positions: { tile: { x: 2, y: 2, z: 2 } },
		});
		const row = { revision: durable.revision, transcript: durable };
		expect(reconcileTranscriptSnapshot(row, incoming)).toMatchObject({
			action: 'write',
			transcript: incoming,
		});
		incoming.handMovements![1].afterMoveIndex = 0;
		expect(reconcileTranscriptSnapshot(row, incoming).action).toBe('conflict');
		incoming.handMovements![1].afterMoveIndex = 1;
		incoming.handMovements![0].positions.tile.x = 9;
		expect(reconcileTranscriptSnapshot(row, incoming).action).toBe('conflict');
		delete incoming.handMovements;
		expect(reconcileTranscriptSnapshot(row, incoming).action).toBe('conflict');
	});

	it('inserts a missing row and ignores exact duplicate or stale snapshots', () => {
		const durable = snapshot('round-1', 2, ['move-1']);

		expect(reconcileTranscriptSnapshot(undefined, snapshot('round-1', 1))).toMatchObject({
			action: 'write',
		});
		expect(
			reconcileTranscriptSnapshot(
				{ revision: durable.revision, transcript: structuredClone(durable) },
				structuredClone(durable),
			),
		).toEqual({ action: 'ignore' });
		expect(
			reconcileTranscriptSnapshot(
				{ revision: durable.revision, transcript: durable },
				snapshot('round-1', 1),
			),
		).toEqual({ action: 'ignore' });
	});

	it('accepts only higher revisions whose round definition and full moves extend the durable prefix', () => {
		const durable = snapshot('round-1', 2, ['move-1']);
		const extension = snapshot('round-1', 3, ['move-1', 'move-2']);
		const result = reconcileTranscriptSnapshot(
			{ revision: durable.revision, transcript: durable },
			extension,
		);

		expect(result).toMatchObject({ action: 'write', transcript: extension });
	});

	it.each([
		{
			name: 'the same revision has different lifecycle data',
			change: (value: GameTranscriptV1) => {
				value.lifecycle.updatedAt = '2026-09-02T05:00:00.000Z';
			},
		},
		{
			name: 'an existing action id has a different move payload',
			change: (value: GameTranscriptV1) => {
				if (value.moves[0]?.type === 'discard') value.moves[0].tileId = 'rewritten-tile';
			},
		},
		{
			name: 'immutable deck metadata changes',
			change: (value: GameTranscriptV1) => {
				value.deck = [{ id: 'injected', color: 'red', number: 1 }];
			},
		},
	])('marks a conflict when $name', ({ name, change }) => {
		const sameRevision = name.includes('same revision');
		const durable = snapshot('round-1', 2, ['move-1']);
		const incoming = sameRevision
			? structuredClone(durable)
			: snapshot('round-1', 3, ['move-1', 'move-2']);
		change(incoming);

		const result = reconcileTranscriptSnapshot(
			{ revision: durable.revision, transcript: durable },
			incoming,
		);

		expect(result).toMatchObject({
			action: 'conflict',
			transcript: {
				revision: durable.revision,
				moves: durable.moves,
				integrity: { status: 'conflicted' },
			},
		});
	});

	it('preserves an existing conflict while accepting a later valid prefix extension', () => {
		const durable = snapshot('round-1', 2, ['move-1']);
		durable.integrity = { status: 'conflicted', reason: 'Earlier divergence.' };
		const extension = snapshot('round-1', 3, ['move-1', 'move-2']);

		const result = reconcileTranscriptSnapshot(
			{ revision: durable.revision, transcript: durable },
			extension,
		);

		expect(result).toMatchObject({
			action: 'write',
			transcript: {
				revision: 3,
				integrity: { status: 'conflicted', reason: 'Earlier divergence.' },
			},
		});
	});
});
