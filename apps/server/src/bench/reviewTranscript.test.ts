import {
	getHanabiFireworkSequence,
	getHanabiScore,
	HANABI_RULE_SETS,
	HanabiFinishedReason,
	HanabiStage,
	isReplayableTranscript,
	replayHanabiReview,
	replayHanabiTranscript,
	type HanabiGameData,
} from '@hanabi/shared';
import { describe, expect, it } from 'vitest';
import { BenchGame, type BenchGameOptions, type BenchTranscript } from './engine.js';
import { toReviewTranscript } from './reviewTranscript.js';

function game(options: Partial<BenchGameOptions> = {}): BenchGame {
	return new BenchGame({
		seed: 'review-adapter',
		playerCount: 3,
		ruleSet: '5-color',
		criticalGameOver: false,
		...options,
	});
}

function board(data: HanabiGameData) {
	return {
		ruleSet: data.ruleSet,
		allowDragging: data.allowDragging,
		showNotes: data.showNotes,
		criticalGameOver: data.criticalGameOver,
		stage: data.stage,
		finishedReason: data.finishedReason,
		turnOrder: data.turnOrder,
		currentPlayerId: data.currentPlayerId,
		remainingTurns: data.remainingTurns,
		clues: data.clues,
		lives: data.lives,
		tiles: data.tiles,
		remainingTiles: data.remainingTiles,
		playedTiles: data.playedTiles,
		discardedTiles: data.discardedTiles,
		playerTiles: data.playerTiles,
		tilePositions: data.tilePositions,
		tileNotes: data.tileNotes,
	};
}

function advance(engine: BenchGame): void {
	const state = engine.state;
	const playerId = state.currentPlayerId!;
	const legal = engine.legalActions(playerId);
	const playable = legal.find(({ action }) => {
		if (action.type !== 'play') return false;
		const tile = state.tiles[action.tileId];
		const built = state.playedTiles.filter((id) => state.tiles[id].color === tile.color).length;
		return getHanabiFireworkSequence(tile.color)[built] === tile.number;
	});
	const selected =
		playable ??
		legal.find(({ action }) => action.type === 'discard') ??
		legal.find(({ action }) => action.type === 'clue')!;
	engine.apply(playerId, selected.id);
}

describe('Bench review transcript adapter', () => {
	it.each(HANABI_RULE_SETS)(
		'replays every recorded %s board exactly for two through five players',
		(ruleSet) => {
			for (const playerCount of [2, 3, 4, 5]) {
				const engine = game({ ruleSet, playerCount });
				const states = [engine.state];
				while (!engine.finished) {
					advance(engine);
					states.push(engine.state);
				}
				const source = engine.transcript();
				const saved = structuredClone(source);
				const review = toReviewTranscript(source, `${ruleSet}-${playerCount}`);
				expect(isReplayableTranscript(review)).toBe(true);
				expect(review.moves).toHaveLength(engine.turn);
				expect(review.moves.map((move) => move.index)).toEqual(
					states.slice(1).map((_, index) => index),
				);
				for (const [cursor, expected] of states.entries()) {
					expect(board(replayHanabiReview(review, cursor))).toEqual(board(expected));
					expect(board(replayHanabiTranscript(review, cursor))).toEqual(board(expected));
				}
				expect(review.result).toMatchObject({
					score: getHanabiScore(engine.state),
					finishedReason: engine.state.finishedReason,
				});
				expect(source).toEqual(saved);
			}
		},
	);

	it('adapts zero-move and interrupted prefixes without manufacturing a terminal result', () => {
		const engine = game();
		for (const count of [0, 1, 4]) {
			while (engine.turn < count) advance(engine);
			const review = toReviewTranscript(engine.transcript(), 'live-game');
			expect(review.lifecycle).toMatchObject({ status: 'in_progress', endedAt: null });
			expect(review.result).toBeUndefined();
			expect(
				review.moves.every(
					(move) => move.postTurn.status === 'in_progress' && !move.postTurn.result,
				),
			).toBe(true);
			expect(isReplayableTranscript(review)).toBe(false);
			expect(() => replayHanabiReview(review, count)).toThrow(/complete, finished/);
			expect(board(replayHanabiReview(review, count, { allowInProgress: true }))).toEqual(
				board(engine.state),
			);
		}
	});

	it.each(['discard', 'play'] as const)(
		'preserves an immediate critical %s ending and same-turn result',
		(type) => {
			let engine = game();
			let tileId: string | undefined;
			for (let seed = 0; seed < 100 && !tileId; seed++) {
				engine = game({ seed: `fatal-review-${seed}`, criticalGameOver: true });
				if (type === 'discard') {
					const clue = engine
						.legalActions('player-1')
						.find(({ action }) => action.type === 'clue')!;
					engine.apply('player-1', clue.id);
				}
				const state = engine.state;
				tileId = state.playerTiles[state.currentPlayerId!].find(
					(id) => state.tiles[id].number === 5,
				);
			}
			expect(tileId).toBeDefined();
			const beforeTurn = engine.turn;
			const playerId = engine.state.currentPlayerId!;
			const selected = engine
				.legalActions(playerId)
				.find(({ action }) => action.type === type && action.tileId === tileId)!;
			engine.apply(playerId, selected.id);
			expect(engine.finished).toBe(true);
			expect(engine.state.finishedReason).toBe(HanabiFinishedReason.DiscardedFatalTile);
			expect(engine.turn).toBe(beforeTurn + 1);
			const review = toReviewTranscript(engine.transcript(), `critical-${type}`);
			expect(review.moves.at(-1)!.postTurn).toMatchObject({
				status: 'finished',
				result: review.result,
			});
			expect(review.result!.finishedReason).toBe(HanabiFinishedReason.DiscardedFatalTile);
			expect(replayHanabiReview(review, beforeTurn).stage).toBe(HanabiStage.Playing);
			expect(board(replayHanabiReview(review, beforeTurn + 1))).toEqual(board(engine.state));
			expect(review.lifecycle.endedAt).toBe(review.moves.at(-1)!.createdAt);
		},
	);

	it('keeps independent run identity and presentation names separate from the deterministic source', () => {
		const source = game().transcript();
		const saved = structuredClone(source);
		const first = toReviewTranscript(source, 'experiment-a/game-0', { 'player-1': 'Sol · high' });
		const second = toReviewTranscript(source, 'experiment-b/game-0');
		expect(first.roundId).not.toBe(second.roundId);
		expect(first.players[0]).toEqual({ id: 'player-1', name: 'Sol · high' });
		expect(first.deck).toEqual(second.deck);
		expect(first.lifecycle.startedAt).toBe('1970-01-01T00:00:00.000Z');
		expect(source).toEqual(saved);
		first.deck![0].number = 5;
		expect(source).toEqual(saved);
	});

	it('accepts both fixed-hand option encodings and rejects changed or stale source data', () => {
		for (const options of [{}, { allowDragging: false as const }]) {
			const engine = game(options);
			advance(engine);
			advance(engine);
			const source = engine.transcript();
			expect(toReviewTranscript(source, 'verified').moves).toHaveLength(2);
			const changes: Array<(transcript: BenchTranscript) => void> = [
				(transcript) => {
					transcript.initialState.clues--;
				},
				(transcript) => {
					transcript.initialState.remainingTiles = [
						...transcript.initialState.remainingTiles,
					].reverse();
				},
				(transcript) => {
					transcript.finalState.lives--;
				},
				(transcript) => {
					transcript.events[0].postTurn.score++;
				},
				(transcript) => {
					transcript.events[0].turn++;
				},
				(transcript) => {
					transcript.events[0].playerId = 'player-3';
				},
				(transcript) => {
					transcript.events[0].action = { type: 'play', tileId: 'missing' };
				},
				(transcript) => {
					transcript.events.pop();
				},
				(transcript) => {
					transcript.options.seed = 'wrong-seed';
				},
			];
			for (const change of changes) {
				const corrupt = structuredClone(source);
				change(corrupt);
				expect(() => toReviewTranscript(corrupt, 'invalid')).toThrow();
			}
		}
		expect(() => toReviewTranscript(null as unknown as BenchTranscript, 'invalid')).toThrow(
			/Unsupported/,
		);
		expect(() =>
			toReviewTranscript({ version: 2 } as unknown as BenchTranscript, 'invalid'),
		).toThrow(/Unsupported/);
		expect(() => toReviewTranscript(game().transcript(), '')).toThrow(/identifier/);
	});
});
