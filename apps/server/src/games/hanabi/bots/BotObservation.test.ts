import {
	generateHanabiGameData,
	generatePlayer,
	HanabiGameActionType,
	HanabiStage,
	type HanabiGameAction,
	type HanabiGameData,
} from '@hanabi/shared';
import { describe, expect, it } from 'vitest';
import { appendBotArrangement, appendBotHistory, createBotHistory } from './BotHistory.js';
import { buildBotObservation } from './BotObservation.js';

function state(overrides: Partial<HanabiGameData> = {}): HanabiGameData {
	return generateHanabiGameData({
		seed: 'PRIVATE-SEED',
		stage: HanabiStage.Playing,
		players: {
			bot: generatePlayer({ id: 'bot', name: 'Bot' }),
			human: generatePlayer({ id: 'human', name: 'Human' }),
		},
		turnOrder: ['human', 'bot'],
		currentPlayerId: 'bot',
		clues: 7,
		tiles: {
			a: { id: 'a', color: 'red', number: 1 },
			b: { id: 'b', color: 'blue', number: 4 },
			c: { id: 'c', color: 'green', number: 3 },
			deckA: { id: 'deckA', color: 'white', number: 5 },
			deckB: { id: 'deckB', color: 'yellow', number: 2 },
		},
		playerTiles: { bot: ['a', 'b'], human: ['c'] },
		tilePositions: {
			a: { x: 10, y: 10, z: 0 },
			b: { x: 60, y: 80, z: 1 },
			c: { x: 10, y: 10, z: 0 },
		},
		remainingTiles: ['deckA', 'deckB'],
		...overrides,
	});
}

function numberClue(game: HanabiGameData): HanabiGameAction {
	return {
		id: 'clue-1',
		type: HanabiGameActionType.GiveNumberClue,
		playerId: 'human',
		recipientId: 'bot',
		number: 1,
		tiles: [game.tiles.a],
	};
}

describe('buildBotObservation', () => {
	it('is invariant to own hidden faces, seed, undealt faces/order, and tile dictionary insertion order', () => {
		const original = state();
		const hiddenChanged = structuredClone(original);
		hiddenChanged.seed = 'DIFFERENT-PRIVATE-SEED';
		hiddenChanged.remainingTiles = ['deckB', 'deckA'];
		hiddenChanged.tiles = {
			deckB: { id: 'deckB', color: 'purple', number: 5 },
			b: { id: 'b', color: 'white', number: 1 },
			c: original.tiles.c,
			deckA: { id: 'deckA', color: 'black', number: 2 },
			a: { id: 'a', color: 'yellow', number: 4 },
		};
		const first = buildBotObservation(original, 'bot', createBotHistory(original));
		const second = buildBotObservation(hiddenChanged, 'bot', createBotHistory(hiddenChanged));
		expect(second).toEqual(first);
		const payload = JSON.stringify(first);
		for (const forbidden of [
			'PRIVATE-SEED',
			'deckA',
			'deckB',
			'remainingTiles',
			'tileNotes',
			'creatorId',
		]) {
			expect(payload).not.toContain(forbidden);
		}
		expect(first.deckCount).toBe(2);
		expect(first.players.find(({ id }) => id === 'bot')?.hand.map(({ face }) => face)).toEqual([
			null,
			null,
		]);
		expect(first.players.find(({ id }) => id === 'human')?.hand[0].face).toEqual({
			color: 'green',
			number: 3,
		});
	});

	it('preserves positive and negative clues without exposing selected tile faces, even with notes hidden', () => {
		const game = state({ showNotes: false, tileNotes: { b: { colors: ['blue'], numbers: [4] } } });
		const history = appendBotHistory(createBotHistory(game), numberClue(game), game);
		const observation = buildBotObservation(game, 'bot', history);
		const hand = observation.players.find(({ id }) => id === 'bot')!.hand;
		expect(hand[0].clueKnowledge).toEqual({
			matchingColors: [],
			matchingNumbers: [1],
			excludedColors: [],
			excludedNumbers: [],
		});
		expect(hand[1].clueKnowledge).toEqual({
			matchingColors: [],
			matchingNumbers: [],
			excludedColors: [],
			excludedNumbers: [1],
		});
		expect(observation.history.moves[0]).toMatchObject({
			type: 'clue',
			clue: { type: 'number', value: 1 },
			touchedTileIds: ['a'],
			untouchedTileIds: ['b'],
			hand: [
				{ tileId: 'a', position: { x: 10, y: 10, z: 0 } },
				{ tileId: 'b', position: { x: 60, y: 80, z: 1 } },
			],
		});
		expect(JSON.stringify(observation.history.moves[0])).not.toContain('"color"');
	});

	it('retains visible deal/draw history while concealing its owner and exposing played cards', () => {
		const initial = state();
		const after = structuredClone(initial);
		after.playerTiles = { bot: ['b', 'deckB'], human: ['c'] };
		after.remainingTiles = ['deckA'];
		after.playedTiles = ['a'];
		after.tilePositions = {
			b: { x: 10, y: 10, z: 0 },
			c: { x: 10, y: 10, z: 0 },
			deckB: { x: 60, y: 10, z: 0 },
		};
		const history = appendBotHistory(
			createBotHistory(initial),
			{
				id: 'play-1',
				type: HanabiGameActionType.Play,
				playerId: 'bot',
				tile: initial.tiles.a,
				valid: true,
				remainingLives: 3,
			},
			after,
		);
		const owner = buildBotObservation(after, 'bot', history);
		const other = buildBotObservation(after, 'human', history);
		expect(
			owner.history.initialHands
				.find(({ playerId }) => playerId === 'bot')
				?.cards.map(({ face }) => face),
		).toEqual([null, null]);
		expect(owner.history.moves[0]).toMatchObject({
			type: 'play',
			tile: { tileId: 'a', color: 'red', number: 1 },
			drawnTiles: [{ tileId: 'deckB', face: null }],
		});
		expect(other.history.moves[0]).toMatchObject({
			drawnTiles: [{ tileId: 'deckB', face: { color: 'yellow', number: 2 } }],
		});
		expect(owner.fireworks[0].tiles).toEqual([{ tileId: 'a', color: 'red', number: 1 }]);
		const changed = structuredClone(history);
		const move = changed.moves[0];
		if (move.type !== 'clue') move.drawnTiles[0].face = { color: 'purple', number: 5 };
		expect(buildBotObservation(after, 'bot', changed)).toEqual(owner);
	});

	it('allowlists nested records instead of spreading unknown fields into provider input', () => {
		const game = state();
		const history = appendBotHistory(createBotHistory(game), numberClue(game), game);
		const marker = 'PRIVATE-INJECTED-FACE';
		Object.assign(history, { seed: marker });
		Object.assign(history.initialHands[1], { secret: marker });
		Object.assign(history.initialHands[1].cards[0].position!, { secret: marker });
		Object.assign(history.moves[0], { tiles: [game.tiles.a], secret: marker });
		Object.assign(history.moves[0].postTurn, { secret: marker });
		const clue = history.moves[0];
		if (clue.type === 'clue') {
			Object.assign(clue.hand[0], { face: game.tiles.a, secret: marker });
			Object.assign(clue.clue, { secret: marker });
		}
		Object.assign(game.tilePositions.a, { secret: marker });
		Object.assign(game.players.bot, { session: marker });
		game.actions = [
			{ id: 'chat', type: HanabiGameActionType.Chat, playerId: 'human', message: marker },
		];
		expect(JSON.stringify(buildBotObservation(game, 'bot', history))).not.toContain(marker);
	});

	it('observes rearranged public positions without claiming an incomplete history is complete', () => {
		const game = state();
		const before = buildBotObservation(game, 'bot');
		game.tilePositions = { ...game.tilePositions, b: { x: 0, y: 100, z: 2 } };
		const after = buildBotObservation(game, 'bot');
		expect(after.history).toEqual({ complete: false, initialHands: [], moves: [] });
		expect(after.players.find(({ id }) => id === 'bot')?.hand[1].position).toEqual({
			x: 0,
			y: 100,
			z: 2,
		});
		expect(after.legalActions).toEqual(before.legalActions);
		expect(after).not.toEqual(before);
	});

	it('ignores the mixed chat log even after more than 1,000 chat messages', () => {
		const game = state();
		const history = appendBotHistory(createBotHistory(game), numberClue(game), game);
		const before = buildBotObservation(game, 'bot', history);
		game.actions = Array.from({ length: 1001 }, (_, index) => ({
			id: `chat-${index}`,
			type: HanabiGameActionType.Chat,
			playerId: 'human',
			message: 'no game information',
		}));
		expect(buildBotObservation(game, 'bot', history)).toEqual(before);
	});

	it('includes variant sequence/copy counts and rejects spectator observations', () => {
		const game = state({ ruleSet: 'rainbow-black-powder' });
		const observation = buildBotObservation(game, 'bot');
		expect(observation.rules.suits.find(({ color }) => color === 'black')).toEqual({
			color: 'black',
			playSequence: [5, 4, 3, 2, 1],
			copies: [
				{ number: 1, count: 1 },
				{ number: 2, count: 2 },
				{ number: 3, count: 2 },
				{ number: 4, count: 2 },
				{ number: 5, count: 3 },
			],
		});
		expect(observation.rules.maxScore).toBe(30);
		expect(() => buildBotObservation(game, 'spectator')).toThrow('seated player');
	});
});

describe('v2 bot observation', () => {
	it('leaves every v1 serialization untouched and marks missing legacy layouts honestly', () => {
		const game = state();
		const history = appendBotHistory(createBotHistory(game), numberClue(game), game);
		expect(buildBotObservation(game, 'bot', history, 1)).toEqual(
			buildBotObservation(game, 'bot', history),
		);
		expect(buildBotObservation(game, 'bot', history, 1).version).toBe(1);
		const enriched = buildBotObservation(game, 'bot', history, 2);
		expect(enriched.history).toMatchObject({
			complete: false,
			turnHistoryComplete: true,
			layoutHistoryComplete: false,
			initialState: null,
		});
		expect(enriched.history.events[0]).toMatchObject({
			type: 'clue',
			eventId: 'clue-1',
			beforeState: null,
		});
	});

	it('projects before deriving knowledge, including historical hidden cards and unseen deck changes', () => {
		const game = state();
		const history = appendBotHistory(createBotHistory(game, 2), numberClue(game), game, game);
		const original = buildBotObservation(game, 'bot', history, 2);
		const hiddenChanged = structuredClone(game);
		hiddenChanged.seed = 'UNSEEN';
		hiddenChanged.tiles = {
			...hiddenChanged.tiles,
			a: { id: 'a', color: 'black', number: 4 },
			b: { id: 'b', color: 'white', number: 1 },
			deckA: { id: 'deckA', color: 'purple', number: 1 },
		};
		hiddenChanged.remainingTiles = [...hiddenChanged.remainingTiles].reverse();
		const changedHistory = structuredClone(history);
		for (const card of changedHistory.initialHands.find(({ playerId }) => playerId === 'bot')!
			.cards) {
			card.face = { color: 'black', number: 5 };
		}
		expect(buildBotObservation(hiddenChanged, 'bot', changedHistory, 2)).toEqual(original);
		const bot = original.players.find(({ id }) => id === 'bot')!;
		expect(bot.hand[0].clueKnowledge.evidence.positive).toEqual([
			{ eventId: 'event-1', clue: { type: 'number', value: 1 } },
		]);
		expect(bot.hand[1].clueKnowledge.evidence.negative).toEqual([
			{ eventId: 'event-1', clue: { type: 'number', value: 1 } },
		]);
		expect(JSON.stringify(original)).not.toContain('deckA');
		expect(original.history.events[0]).toMatchObject({
			touchedCount: 1,
			knowledgeChanges: [
				{ tileId: 'a', firstPositiveClue: true, newConstraint: true },
				{ tileId: 'b', firstPositiveClue: false, newConstraint: true },
			],
		});
	});

	it('preserves event-time board and layouts, with a fresh draw after clue and rearrangement', () => {
		const game = state({ showNotes: false });
		const before = structuredClone(game);
		let history = appendBotHistory(createBotHistory(game, 2), numberClue(game), game, before);
		const oldPositions = game.tilePositions;
		game.tilePositions = { ...oldPositions, a: { x: 180, y: 80, z: 1 }, b: { x: 10, y: 10, z: 0 } };
		history = appendBotArrangement(history, 'bot', oldPositions, game, 'event-1');
		const rearranged = buildBotObservation(game, 'bot', history, 2);
		expect(rearranged.players.find(({ id }) => id === 'bot')!.layout).toMatchObject({
			orderedRow: ['b'],
			lowerArea: [{ tileId: 'a', x: 0.5, stackOrder: 0 }],
		});
		expect(rearranged.players.find(({ id }) => id === 'human')!.layout.orderedRow).toEqual(['c']);
		expect(rearranged.history.events[1]).toMatchObject({
			type: 'arrangement',
			sourceClueEventId: 'event-1',
			before: { layout: { orderedRow: ['a'] } },
			after: { layout: { orderedRow: ['b'] } },
		});
		const prePlay = structuredClone(game);
		game.playerTiles = { bot: ['b', 'deckA'], human: ['c'] };
		game.playedTiles = ['a'];
		game.remainingTiles = ['deckB'];
		game.tilePositions = { ...game.tilePositions, deckA: { x: 60, y: 10, z: 0 } };
		history = appendBotHistory(
			history,
			{
				id: 'play-1',
				type: HanabiGameActionType.Play,
				playerId: 'bot',
				tile: game.tiles.a,
				valid: true,
				remainingLives: 3,
			},
			game,
			prePlay,
		);
		const observed = buildBotObservation(game, 'bot', history, 2);
		const hand = observed.players.find(({ id }) => id === 'bot')!.hand;
		expect(hand[0].clueKnowledge.evidence.negative).toHaveLength(1);
		expect(hand[1]).toMatchObject({
			tileId: 'deckA',
			face: null,
			arrivalEventId: 'event-3',
			clueKnowledge: { evidence: { positive: [], negative: [] } },
		});
		expect(hand[1].clueKnowledge.possibleIdentities).toHaveLength(25);
		expect(observed.history.events[0]).toMatchObject({ beforeState: { playedTiles: [] } });
		expect(observed.history.events[2]).toMatchObject({
			type: 'play',
			turnIndex: 2,
			drawnTiles: [{ tileId: 'deckA', face: null }],
		});
	});

	it('keeps teammates literal possibilities separate from visible identity and own-only reductions', () => {
		const game = state();
		game.tiles.c.number = 5;
		const observation = buildBotObservation(game, 'bot', createBotHistory(game, 2), 2);
		const human = observation.players.find(({ id }) => id === 'human')!;
		expect(human.hand[0].face).toEqual({ color: 'green', number: 5 });
		expect(human.hand[0].clueKnowledge.possibleIdentities).toHaveLength(25);
		expect(human.hand[0].clueKnowledge).not.toHaveProperty('observerPossibleIdentities');
		const own = observation.players.find(({ id }) => id === 'bot')!.hand[0];
		expect(own.clueKnowledge.possibleIdentities).toContainEqual({ color: 'green', number: 5 });
		expect(own.clueKnowledge.observerPossibleIdentities).not.toContainEqual({
			color: 'green',
			number: 5,
		});
	});

	it('never promotes the single-card play convention to a guaranteed suit', () => {
		const game = state();
		game.tiles.a.number = 2;
		game.tiles = { ...game.tiles, redOne: { id: 'redOne', color: 'red', number: 1 } };
		game.playedTiles = ['redOne'];
		const history = appendBotHistory(
			createBotHistory(game, 2),
			{
				id: 'two',
				type: HanabiGameActionType.GiveNumberClue,
				playerId: 'human',
				recipientId: 'bot',
				number: 2,
				tiles: [game.tiles.a],
			},
			game,
			game,
		);
		const observation = buildBotObservation(game, 'bot', history, 2);
		expect(
			observation.players.find(({ id }) => id === 'bot')!.hand[0].clueKnowledge.possibleIdentities,
		).toHaveLength(5);
		expect(observation.history.events[0]).toMatchObject({
			beforeState: { playedTiles: [{ tileId: 'redOne', color: 'red', number: 1 }] },
			touchedCount: 1,
		});
	});

	it('allowlists every nested v2 event and knowledge source', () => {
		const game = state();
		let history = appendBotHistory(createBotHistory(game, 2), numberClue(game), game, game);
		const previous = game.tilePositions;
		game.tilePositions = { ...previous, a: { x: 180, y: 80, z: 0 } };
		history = appendBotArrangement(history, 'bot', previous, game, 'event-1');
		if (history.version !== 2) throw new Error('Expected v2');
		const marker = 'PRIVATE-V2';
		Object.assign(history.initialState, { secret: marker });
		for (const event of history.events) {
			Object.assign(event, { secret: marker });
			if (event.type === 'arrangement') {
				Object.assign(event.before[0], { face: marker });
				Object.assign(event.after[0].position!, { secret: marker });
			} else if (event.type === 'clue') {
				Object.assign(event.beforeState!, { secret: marker });
				Object.assign(event.clue, { secret: marker });
			}
		}
		expect(JSON.stringify(buildBotObservation(game, 'bot', history, 2))).not.toContain(marker);
	});
});
