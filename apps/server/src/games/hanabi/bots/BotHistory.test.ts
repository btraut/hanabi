import {
	generateHanabiGameData,
	HanabiGameActionType,
	HanabiStage,
	type HanabiGameData,
} from '@hanabi/shared';
import { describe, expect, it } from 'vitest';
import {
	appendBotArrangement,
	appendBotHistory,
	createBotHistory,
	isBotHistory,
	type BotHistory,
} from './BotHistory.js';

function state(): HanabiGameData {
	return generateHanabiGameData({
		stage: HanabiStage.Playing,
		turnOrder: ['bot', 'human'],
		currentPlayerId: 'bot',
		tiles: {
			first: { id: 'first', color: 'red', number: 1 },
			second: { id: 'second', color: 'blue', number: 2 },
			draw: { id: 'draw', color: 'green', number: 3 },
		},
		playerTiles: { bot: ['first'], human: ['second'] },
		remainingTiles: ['draw'],
	});
}

describe('BotHistory', () => {
	it('snapshots initial hands without retaining references to live faces or positions', () => {
		const game = state();
		game.tilePositions = { first: { x: 10, y: 10, z: 0 } };
		const history = createBotHistory(game);
		game.tiles.first.color = 'white';
		game.tilePositions.first.x = 90;
		expect(history.initialHands[0].cards[0]).toEqual({
			tileId: 'first',
			position: { x: 10, y: 10, z: 0 },
			face: { color: 'red', number: 1 },
		});
		expect(isBotHistory(history)).toBe(true);
	});

	it('appends one revealed discard and one drawn card immutably and ignores duplicate/chat events', () => {
		const game = state();
		const initial = createBotHistory(game);
		game.playerTiles = { bot: ['draw'], human: ['second'] };
		game.remainingTiles = [];
		game.discardedTiles = ['first'];
		game.remainingTurns = 2;
		const action = {
			id: 'discard',
			type: HanabiGameActionType.Discard as const,
			playerId: 'bot',
			tile: game.tiles.first,
		};
		const history = appendBotHistory(initial, action, game);
		expect(initial.moves).toEqual([]);
		expect(history.moves).toHaveLength(1);
		expect(history.moves[0]).toMatchObject({
			type: 'discard',
			tile: game.tiles.first,
			drawnTiles: [{ tileId: 'draw', face: { color: 'green', number: 3 } }],
			handAfter: [{ tileId: 'draw', position: null }],
			postTurn: { deckCount: 0, remainingTurns: 2 },
		});
		expect(appendBotHistory(history, action, game)).toBe(history);
		expect(
			appendBotHistory(
				history,
				{ id: 'chat', type: HanabiGameActionType.Chat, playerId: 'human', message: 'hi' },
				game,
			),
		).toBe(history);
		expect(isBotHistory(history)).toBe(true);
	});

	it('does not invent another draw when the deck is empty', () => {
		const game = state();
		game.playerTiles = { bot: ['first', 'draw'], human: ['second'] };
		game.remainingTiles = [];
		const initial = createBotHistory(game);
		game.playerTiles = { bot: ['draw'], human: ['second'] };
		const history = appendBotHistory(
			initial,
			{
				id: 'discard',
				type: HanabiGameActionType.Discard,
				playerId: 'bot',
				tile: game.tiles.first,
			},
			game,
		);
		expect(history.moves[0]).toMatchObject({
			drawnTiles: [],
			handAfter: [{ tileId: 'draw', position: null }],
		});
	});

	it('rejects malformed nested persistence and unbounded history', () => {
		const history = createBotHistory(state());
		expect(isBotHistory(null)).toBe(false);
		expect(isBotHistory({ ...history, version: 2 })).toBe(false);
		expect(
			isBotHistory({
				...history,
				initialHands: [
					{
						playerId: 'bot',
						cards: [
							{
								tileId: 'a',
								position: { x: Infinity, y: 0, z: 0 },
								face: { color: 'red', number: 1 },
							},
						],
					},
				],
			}),
		).toBe(false);
		expect(isBotHistory({ ...history, moves: Array.from({ length: 513 }, () => ({})) })).toBe(
			false,
		);
	});

	it('records clue-time context and a causally linked arrangement without spending another turn', () => {
		const before = state();
		before.tilePositions = { first: { x: 10, y: 10, z: 0 }, second: { x: 10, y: 10, z: 0 } };
		before.clues = 8;
		const after = structuredClone(before);
		after.clues = 7;
		after.currentPlayerId = 'human';
		const clue = appendBotHistory(
			createBotHistory(before, 2),
			{
				id: 'clue',
				type: HanabiGameActionType.GiveNumberClue,
				playerId: 'human',
				recipientId: 'bot',
				number: 1,
				tiles: [before.tiles.first],
			},
			after,
			before,
		);
		const oldPositions = after.tilePositions;
		after.tilePositions = { ...oldPositions, first: { x: 10, y: 80, z: 0 } };
		const history = appendBotArrangement(clue, 'bot', oldPositions, after, 'event-1');
		expect(history.version).toBe(2);
		if (history.version !== 2) return;
		expect(history.events).toMatchObject([
			{
				type: 'clue',
				eventId: 'event-1',
				sequence: 1,
				turnIndex: 1,
				beforeState: { clues: 8 },
				postTurn: { clues: 7 },
			},
			{
				type: 'arrangement',
				eventId: 'event-2',
				sequence: 2,
				turnIndex: 1,
				sourceClueEventId: 'event-1',
				changedTileIds: ['first'],
				before: [{ tileId: 'first', position: { y: 10 } }],
				after: [{ tileId: 'first', position: { y: 80 } }],
			},
		]);
		expect(history.moves).toHaveLength(1);
		expect(appendBotArrangement(history, 'bot', after.tilePositions, after)).toBe(history);
		expect(isBotHistory(JSON.parse(JSON.stringify(history)))).toBe(true);
		expect(history.initialHands[0].cards[0].position?.y).toBe(10);
	});

	it('preserves more than 512 committed arrangements and validates their ordering after serialization', () => {
		const game = state();
		game.tilePositions = { first: { x: 10, y: 80, z: 0 } };
		let history: BotHistory = createBotHistory(game, 2);
		for (let index = 0; index < 600; index += 1) {
			const previous = game.tilePositions;
			game.tilePositions = { first: { x: 10 + (index % 2 ? 0 : 10), y: 80, z: 0 } };
			history = appendBotArrangement(history, 'bot', previous, game);
		}
		if (history.version !== 2) throw new Error('Expected v2 history');
		expect(history.events).toHaveLength(600);
		expect(history.moves).toHaveLength(0);
		expect(history.events[599]).toMatchObject({
			eventId: 'event-600',
			sequence: 600,
			turnIndex: 0,
		});
		expect(isBotHistory(JSON.parse(JSON.stringify(history)))).toBe(true);
		const malformed = structuredClone(history);
		malformed.events[599].turnIndex = 1;
		expect(isBotHistory(malformed)).toBe(false);
		malformed.events[599].turnIndex = 0;
		malformed.events[599].eventId = 'event-1';
		expect(isBotHistory(malformed)).toBe(false);
	});

	it('keeps legacy records unchanged when arrangements occur', () => {
		const game = state();
		const history = createBotHistory(game);
		expect(appendBotArrangement(history, 'bot', {}, game)).toBe(history);
		expect(Object.keys(history)).toEqual(['version', 'complete', 'initialHands', 'moves']);
	});
});
