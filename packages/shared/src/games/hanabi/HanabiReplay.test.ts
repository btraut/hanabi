import { describe, expect, it } from 'vitest';
import type {
	GameTranscriptMove,
	GameTranscriptPostTurn,
	GameTranscriptV1,
} from './GameTranscript.js';
import {
	generateRandomDeck,
	getHanabiScore,
	HANABI_RULE_SETS,
	HanabiFinishedReason,
	HanabiGameActionType,
	HanabiStage,
	type HanabiRuleSet,
	type HanabiTileColor,
	type HanabiTileNumber,
} from './HanabiGameData.js';
import {
	isReplayableTranscript,
	getHanabiReviewSteps,
	replayHanabiReview,
	projectHanabiReplay,
	replayHanabiTranscript,
} from './HanabiReplay.js';

function fixture(ruleSet: HanabiRuleSet = '5-color'): GameTranscriptV1 {
	const [tiles, ids] = generateRandomDeck(ruleSet, 'review-fixture');
	const take = (color: HanabiTileColor, number: HanabiTileNumber): string => {
		const index = ids.findIndex((id) => tiles[id].color === color && tiles[id].number === number);
		return ids.splice(index, 1)[0];
	};
	const a = [take('red', 1), take('red', 2), take('red', 4), take('green', 1), take('white', 1)];
	const b = [take('blue', 1), take('blue', 3), take('blue', 4), take('green', 1), take('white', 1)];
	const score = ruleSet.includes('black-powder') ? 0 : 1;
	const result = {
		finishedReason: HanabiFinishedReason.OutOfLives,
		score,
		clues: 8,
		lives: 0,
		remainingTurns: null,
	};
	const after = (nextPlayerId: string, clues: number, lives = 3): GameTranscriptPostTurn => ({
		nextPlayerId,
		clues,
		lives,
		score,
		remainingTurns: null,
		status: 'in_progress',
	});
	const base = (index: number, actorId: string) => ({
		index,
		actorId,
		actionId: `move-${index}`,
		createdAt: `2026-09-04T12:00:0${index}.000Z`,
	});
	const moves: GameTranscriptMove[] = [
		{
			...base(0, 'a'),
			type: 'clue',
			recipientId: 'b',
			clue: { type: 'number', value: 1 },
			selectedTileIds: [b[0], b[3], b[4]],
			postTurn: { ...after('b', 7), score: 0 },
		},
		{ ...base(1, 'b'), type: 'play', tileId: b[0], valid: true, postTurn: after('a', 7) },
		{ ...base(2, 'a'), type: 'discard', tileId: a[1], postTurn: after('b', 8) },
		{ ...base(3, 'b'), type: 'play', tileId: b[1], valid: false, postTurn: after('a', 8, 2) },
		{ ...base(4, 'a'), type: 'play', tileId: a[2], valid: false, postTurn: after('b', 8, 1) },
		{
			...base(5, 'b'),
			type: 'play',
			tileId: b[2],
			valid: false,
			postTurn: { ...after('a', 8, 0), status: 'finished', result },
		},
	];
	return {
		version: 1,
		revision: 7,
		roundId: 'round',
		gameId: 'game',
		gameCode: 'review',
		rules: { ruleSet, allowDragging: true, showNotes: true, criticalGameOver: false },
		players: [
			{ id: 'a', name: 'Alice' },
			{ id: 'b', name: 'Bob' },
		],
		dealOrder: [
			{ playerId: 'a', tileIds: a },
			{ playerId: 'b', tileIds: b },
		],
		turnOrder: ['a', 'b'],
		deck: [...a, ...b, ...ids].map((id) => tiles[id]),
		moves,
		lifecycle: {
			status: 'finished',
			startedAt: '2026-09-04T12:00:00.000Z',
			updatedAt: '2026-09-04T12:00:05.000Z',
			endedAt: '2026-09-04T12:00:05.000Z',
		},
		integrity: { status: 'complete' },
		result,
	};
}

describe('Hanabi replay', () => {
	it('keeps old recordings and their gameplay cursor behavior unchanged', () => {
		const transcript = fixture();
		expect(getHanabiReviewSteps(transcript)).toEqual(transcript.moves);
		for (let cursor = 0; cursor <= transcript.moves.length; cursor += 1) {
			expect(replayHanabiReview(transcript, cursor)).toEqual(
				replayHanabiTranscript(transcript, cursor),
			);
		}
	});

	it('uses acceptance order for simultaneous movements and rejects corrupt anchors', () => {
		const transcript = fixture();
		const tileId = transcript.dealOrder![0].tileIds[0];
		transcript.handMovements = [1, 2].map((index) => ({
			type: 'reposition',
			id: `drag-${index}`,
			actorId: 'a',
			createdAt: '2026-09-04T12:00:00.000Z',
			afterMoveIndex: 0,
			positions: { [tileId]: { x: index * 10, y: 100, z: index } },
		}));
		const saved = structuredClone(transcript);
		expect(replayHanabiReview(transcript, 2).tilePositions[tileId].x).toBe(20);
		expect(replayHanabiReview(transcript, 1).tilePositions[tileId].x).toBe(10);
		expect(replayHanabiReview(transcript, 2).actions).toEqual([]);
		expect(replayHanabiReview(transcript, 0).tilePositions[tileId].y).not.toBe(100);
		expect(transcript).toEqual(saved);
		transcript.handMovements[0].afterMoveIndex = 99;
		expect(() => getHanabiReviewSteps(transcript)).toThrow(/sequence/);
	});

	it.each(HANABI_RULE_SETS)('reconstructs initial, intermediate and final %s boards', (ruleSet) => {
		const transcript = fixture(ruleSet);
		const initial = replayHanabiTranscript(transcript, 0);
		expect(initial).toMatchObject({
			...transcript.rules,
			stage: HanabiStage.Playing,
			clues: 8,
			lives: 3,
			currentPlayerId: 'a',
			actions: [],
			playedTiles: [],
			discardedTiles: [],
			tileNotes: {},
		});
		expect(initial.playerTiles.a).toEqual(transcript.dealOrder![0].tileIds);
		expect(initial.playerTiles.b).toEqual(transcript.dealOrder![1].tileIds);
		expect(initial.remainingTiles).toEqual(
			transcript
				.deck!.slice(10)
				.map(({ id }) => id)
				.reverse(),
		);
		expect(Object.values(initial.tiles)).toEqual(transcript.deck);

		const afterClue = replayHanabiTranscript(transcript, 1);
		expect(afterClue.clues).toBe(7);
		expect(afterClue.tileNotes[initial.playerTiles.b[0]]).toEqual({ colors: [], numbers: [1] });
		expect(afterClue.tileNotes[initial.playerTiles.b[1]]).toBeUndefined();
		const afterPlay = replayHanabiTranscript(transcript, 2);
		expect(afterPlay.playerTiles.b).toEqual([
			...initial.playerTiles.b.slice(1),
			transcript.deck![10].id,
		]);
		expect(afterPlay.playedTiles).toEqual([initial.playerTiles.b[0]]);
		expect(afterPlay.actions[1]).toMatchObject({ type: HanabiGameActionType.Play, valid: true });

		const final = replayHanabiTranscript(transcript, transcript.moves.length);
		expect(final).toMatchObject({
			stage: HanabiStage.Finished,
			finishedReason: HanabiFinishedReason.OutOfLives,
			lives: 0,
			clues: 8,
			currentPlayerId: 'a',
		});
		expect(final.discardedTiles).toEqual([
			initial.playerTiles.a[1],
			initial.playerTiles.b[1],
			initial.playerTiles.a[2],
			initial.playerTiles.b[2],
		]);
		expect(getHanabiScore(final)).toBe(transcript.result!.score);
		expect(final.remainingTiles.length).toBe(transcript.deck!.length - 15);
		// A terminal failed play still receives a replacement card.
		expect(final.playerTiles.b.at(-1)).toBe(transcript.deck![14].id);
		expect(final.actions).toHaveLength(6);
	});

	it('reconstructs exhausted decks, shrinking hands, and the final-turn clock', () => {
		const transcript = fixture();
		transcript.deck = transcript.deck!.slice(0, 12);
		transcript.moves = transcript.moves.slice(0, 5);
		transcript.moves[2].postTurn.remainingTurns = 2;
		transcript.moves[3].postTurn.remainingTurns = 1;
		const result = {
			...transcript.result!,
			finishedReason: HanabiFinishedReason.OutOfTurns,
			lives: 1,
			remainingTurns: 0,
		};
		transcript.result = result;
		transcript.moves[4].postTurn = {
			...transcript.moves[4].postTurn,
			remainingTurns: 0,
			status: 'finished',
			result,
		};
		expect(replayHanabiTranscript(transcript, 3).remainingTurns).toBe(2);
		const final = replayHanabiTranscript(transcript, 5);
		expect(final.remainingTiles).toEqual([]);
		expect(final.playerTiles.a).toHaveLength(4);
		expect(final.playerTiles.b).toHaveLength(4);
		expect(final.remainingTurns).toBe(0);
		expect(final.finishedReason).toBe(HanabiFinishedReason.OutOfTurns);
	});

	it('uses recorded rainbow clue selections and accumulates only past notes', () => {
		const transcript = fixture('rainbow');
		const rainbow = transcript.deck!.find((tile) => tile.color === 'rainbow')!;
		const handTile = transcript.dealOrder![1].tileIds[3];
		const original = transcript.deck!.find((tile) => tile.id === handTile)!;
		[original.color, rainbow.color] = [rainbow.color, original.color];
		const clue = transcript.moves[0];
		if (clue.type !== 'clue') throw new Error('Expected clue fixture');
		clue.clue = { type: 'color', value: 'red' };
		clue.selectedTileIds = [handTile];
		expect(replayHanabiTranscript(transcript, 0).tileNotes).toEqual({});
		expect(replayHanabiTranscript(transcript, 1).tileNotes[handTile]).toEqual({
			colors: ['red'],
			numbers: [],
		});
	});

	it('can scrub backwards without mutating the transcript or earlier snapshots', () => {
		const transcript = fixture();
		const saved = structuredClone(transcript);
		const first = replayHanabiTranscript(transcript, 1);
		const savedFirst = structuredClone(first);
		replayHanabiTranscript(transcript, 6);
		expect(replayHanabiTranscript(transcript, 1)).toEqual(savedFirst);
		expect(replayHanabiTranscript(transcript, 0).actions).toEqual([]);
		expect(transcript).toEqual(saved);
		expect(first).toEqual(savedFirst);
	});

	it('conceals own identities and clue history while preserving public information', () => {
		const transcript = fixture();
		const authoritative = replayHanabiTranscript(transcript, 2);
		const saved = structuredClone(authoritative);
		const bob = projectHanabiReplay(authoritative, 'b', false);
		for (const id of [...bob.playerTiles.b, ...bob.remainingTiles]) {
			expect(bob.tiles[id]).toEqual({ id, color: 'white', number: 1, concealed: true });
		}
		for (const id of [...bob.playerTiles.a, ...bob.playedTiles])
			expect(bob.tiles[id].concealed).toBeUndefined();
		const clue = bob.actions[0];
		if (clue.type !== HanabiGameActionType.GiveNumberClue) throw new Error('Expected clue');
		expect(clue.tiles.find((tile) => tile.id === bob.playerTiles.b[2])?.concealed).toBe(true);
		expect(clue.tiles.find((tile) => tile.id === bob.playedTiles[0])?.concealed).toBeUndefined();
		expect(bob.seed).toBe('');
		const alice = projectHanabiReplay(authoritative, 'a', false);
		expect(alice.tiles[alice.playerTiles.a[0]].concealed).toBe(true);
		expect(alice.tiles[alice.playerTiles.b[0]].concealed).toBeUndefined();
		const revealed = projectHanabiReplay(authoritative, 'b', true);
		expect(revealed.tiles[revealed.playerTiles.b[0]].concealed).toBeUndefined();
		expect(revealed.tiles[revealed.remainingTiles[0]].concealed).toBe(true);
		expect(authoritative).toEqual(saved);
		const terminal = projectHanabiReplay(replayHanabiTranscript(transcript, 6), 'a', false);
		expect(terminal.tiles[terminal.playerTiles.a[0]].concealed).toBe(true);
	});

	it('rejects unfinished, reset, partial, conflicted, and incomplete recordings', () => {
		for (const status of ['in_progress', 'reset'] as const) {
			const transcript = fixture();
			transcript.lifecycle.status = status;
			expect(isReplayableTranscript(transcript)).toBe(false);
			expect(() => replayHanabiTranscript(transcript, 0)).toThrow(/complete, finished/);
		}
		for (const status of ['partial', 'conflicted'] as const) {
			const transcript = fixture();
			transcript.integrity.status = status;
			expect(isReplayableTranscript(transcript)).toBe(false);
		}
		for (const field of ['deck', 'dealOrder'] as const) {
			const transcript = fixture();
			transcript[field] = null;
			expect(isReplayableTranscript(transcript)).toBe(false);
		}
		expect(isReplayableTranscript(undefined)).toBe(false);
		expect(isReplayableTranscript(null)).toBe(false);
		const missingResult = fixture();
		delete missingResult.result;
		expect(isReplayableTranscript(missingResult)).toBe(false);
	});

	it('rejects invalid cursor, perspective, deal, or tile references', () => {
		const transcript = fixture();
		for (const cursor of [-1, 0.5, 7, NaN, Infinity])
			expect(() => replayHanabiTranscript(transcript, cursor)).toThrow(/position/);
		expect(() =>
			projectHanabiReplay(replayHanabiTranscript(transcript, 0), 'unknown', false),
		).toThrow(/player/);
		transcript.dealOrder![0].tileIds[0] = 'missing';
		expect(() => replayHanabiTranscript(transcript, 0)).toThrow(/deal/);
		const badMove = fixture();
		const play = badMove.moves[1];
		if (play.type !== 'play') throw new Error('Expected play fixture');
		play.tileId = 'missing';
		expect(() => replayHanabiTranscript(badMove, 2)).toThrow(/actor hand/);
	});
});
