import {
	getHanabiCompletionTileCount,
	getHanabiFireworkSequence,
	getHanabiMaxScore,
	getHanabiRuleSetColors,
	getHanabiTileCopyCount,
	getScope,
	HANABI_RULE_SETS,
	HanabiFinishedReason,
	PubSub,
	type DebugPlayerAction,
	type HanabiGameData,
	type HanabiMessage,
	type HanabiRuleSet,
} from '@hanabi/shared';
import { describe, expect, it, vi } from 'vitest';
import HanabiGame, { type HanabiGameSerialized } from '../games/hanabi/HanabiGame.js';
import { getBotLegalActions, type BotLegalAction } from '../games/hanabi/bots/BotLegalActions.js';
import type ServerSocketManager from '../utils/SocketManager.js';
import { BenchGame, type BenchGameOptions } from './engine.js';

function game(options: Partial<BenchGameOptions> = {}) {
	return new BenchGame({
		seed: 'engine-tests',
		playerCount: 3,
		ruleSet: '5-color',
		criticalGameOver: false,
		...options,
	});
}

function choose(
	engine: BenchGame,
	predicate: (action: DebugPlayerAction) => boolean,
): BotLegalAction {
	const action = engine
		.legalActions(engine.state.currentPlayerId!)
		.find((choice) => predicate(choice.action));
	if (!action) throw new Error('No matching test action.');
	return action;
}

function act(engine: BenchGame, predicate: (action: DebugPlayerAction) => boolean) {
	return engine.apply(engine.state.currentPlayerId!, choose(engine, predicate).id);
}

function exhaustWithoutPlaying(engine: BenchGame) {
	while (!engine.finished)
		act(engine, (action) =>
			engine.state.clues < 8 ? action.type === 'discard' : action.type === 'clue',
		);
}

describe('BenchGame', () => {
	it('deals deterministic fresh games with stable acquisition IDs and ordered seats', () => {
		const first = game();
		const second = game();
		expect(first.transcript()).toEqual(second.transcript());
		expect(first.state.turnOrder).toEqual(['player-1', 'player-2', 'player-3']);
		expect(first.state.playerTiles['player-1']).toEqual([
			'card-1',
			'card-2',
			'card-3',
			'card-4',
			'card-5',
		]);
		expect(first.observe('player-1').deckCount).toBe(35);
		expect(game({ seed: 'another-deal' }).state.tiles).not.toEqual(first.state.tiles);
		const clonedState = first.state;
		clonedState.clues = 0;
		clonedState.playerTiles['player-1'].pop();
		expect(first.state.clues).toBe(8);
		expect(first.state.playerTiles['player-1']).toHaveLength(5);
	});

	it.each(HANABI_RULE_SETS)('uses shared deck composition and rules for %s', (ruleSet) => {
		for (const playerCount of [2, 3, 4, 5]) {
			const engine = game({ ruleSet, playerCount });
			const data = engine.state;
			const colors = getHanabiRuleSetColors(ruleSet);
			expect(Object.keys(data.tiles)).toHaveLength(colors.length * 10);
			for (const color of colors) {
				for (const number of [1, 2, 3, 4, 5] as const) {
					expect(
						Object.values(data.tiles).filter(
							(tile) => tile.color === color && tile.number === number,
						),
					).toHaveLength(getHanabiTileCopyCount(color, number));
				}
			}
			expect(
				Object.values(data.playerTiles).every((hand) => hand.length === (playerCount < 4 ? 5 : 4)),
			).toBe(true);
			expect(engine.rules()).toContain(`${playerCount}-player`);
			expect(engine.rules()).toContain(`Maximum score is ${getHanabiMaxScore(ruleSet)}`);
			expect(engine.rules()).toContain(
				`all ${getHanabiCompletionTileCount(ruleSet)} required plays`,
			);
		}
	});

	it('rejects invalid setup, unknown observers, cursors, wrong turns and illegal actions without mutation', () => {
		for (const playerCount of [1, 6, 2.5, NaN]) expect(() => game({ playerCount })).toThrow();
		expect(() => game({ seed: '' })).toThrow();
		expect(() => game({ ruleSet: 'unknown' as HanabiRuleSet })).toThrow();
		const engine = game();
		const before = engine.transcript();
		expect(() => engine.observe('nobody')).toThrow();
		for (const cursor of [-1, 1, 0.5, NaN])
			expect(() => engine.observe('player-1', cursor)).toThrow();
		expect(engine.legalActions('player-2')).toEqual([]);
		expect(engine.legalActions('nobody')).toEqual([]);
		expect(engine.legalActions('player-1').some(({ action }) => action.type === 'discard')).toBe(
			false,
		);
		expect(() => engine.apply('player-2', 'action-0')).toThrow();
		expect(() => engine.apply('player-1', 'missing')).toThrow();
		expect(engine.transcript()).toEqual(before);
	});

	it('provides literal clue events without card faces and restricts clue legality', () => {
		const engine = game({ ruleSet: 'rainbow-black-powder' });
		const before = engine.state;
		const legal = choose(engine, (action) => action.type === 'clue' && action.color !== undefined);
		if (legal.action.type !== 'clue') throw new Error('Expected a clue.');
		const clue = legal.action;
		const event = engine.apply('player-1', legal.id);
		expect(event.tile).toBeUndefined();
		expect(event.drawnCard).toBeUndefined();
		expect(event.postTurn.clues).toBe(7);
		expect(event.touchedTileIds!.length).toBeGreaterThan(0);
		expect([...event.touchedTileIds!, ...event.untouchedTileIds!].sort()).toEqual(
			[...before.playerTiles[clue.to]].sort(),
		);
		for (const id of event.touchedTileIds!) {
			expect([clue.color, 'rainbow']).toContain(before.tiles[id].color);
			expect(before.tiles[id].color).not.toBe('black');
		}
		const own = engine.observe(clue.to).hands.find((hand) => hand.playerId === clue.to)!;
		expect(own.cards.every((card) => card.face === null)).toBe(true);
		expect(
			own.cards.filter((card) => card.clues.colors.includes(clue.color!)).map((card) => card.id),
		).toEqual(event.touchedTileIds);
		while (engine.state.clues) act(engine, (action) => action.type === 'clue');
		expect(
			engine
				.legalActions(engine.state.currentPlayerId!)
				.every(({ action }) => action.type !== 'clue'),
		).toBe(true);
	});

	it('reveals action outcomes but conceals replacement cards to their owner even at game end', () => {
		const engine = game();
		const observer = 'player-1';
		const initial = engine.observe(observer);
		expect(
			initial.hands
				.find((hand) => hand.playerId === observer)!
				.cards.every((card) => card.face === null),
		).toBe(true);
		expect(
			initial.hands
				.filter((hand) => hand.playerId !== observer)
				.flatMap((hand) => hand.cards)
				.every((card) => card.face !== null),
		).toBe(true);
		const action = choose(engine, (value) => value.type === 'play');
		const result = engine.apply(observer, action.id);
		expect(result.tile).toEqual(
			engine.transcript().initialState.tiles[
				action.action.type === 'play' ? action.action.tileId : ''
			],
		);
		expect(result.drawnCard!.face).not.toBeNull();
		expect(engine.observe(observer).events[0].drawnCard!.face).toBeNull();
		expect(engine.observe('player-2').events[0].drawnCard!.face).not.toBeNull();
		expect(engine.observe(observer, 1).events).toEqual([]);
		while (!engine.finished) act(engine, (value) => value.type === 'play');
		const terminal = engine.observe(observer);
		expect(
			terminal.hands
				.find((hand) => hand.playerId === observer)!
				.cards.every((card) => card.face === null),
		).toBe(true);
		expect(
			terminal.events
				.filter((event) => event.playerId === observer && event.drawnCard)
				.every((event) => event.drawnCard!.face === null),
		).toBe(true);
		for (const forbidden of [
			'seed',
			'tiles',
			'remainingTiles',
			'possibleIdentities',
			'observerPossibleIdentities',
		])
			expect(terminal).not.toHaveProperty(forbidden);
		expect(terminal.legalActions).toEqual([]);
		expect(() => engine.apply(engine.state.currentPlayerId!, 'action-0')).toThrow();
	});

	it.each([2, 3, 4, 5])('counts exactly %i final turns after the last draw', (playerCount) => {
		const engine = game({ playerCount });
		while (engine.state.remainingTiles.length)
			act(engine, (action) =>
				engine.state.clues < 8 ? action.type === 'discard' : action.type === 'clue',
			);
		const lastDrawTurn = engine.turn;
		expect(engine.state.remainingTurns).toBe(playerCount);
		expect(engine.finished).toBe(false);
		exhaustWithoutPlaying(engine);
		expect(engine.turn - lastDrawTurn).toBe(playerCount);
		expect(engine.state.finishedReason).toBe(HanabiFinishedReason.OutOfTurns);
		expect(engine.state.remainingTurns).toBe(0);
		expect(engine.state.lives).toBe(3);
	});

	it('enforces optional critical loss while ordinary games continue after a unique-card misplay', () => {
		let seed = 0;
		while (
			!game({ seed: String(seed) }).state.playerTiles['player-1'].some(
				(id) => game({ seed: String(seed) }).state.tiles[id].number === 5,
			)
		)
			seed += 1;
		for (const criticalGameOver of [false, true]) {
			const engine = game({ seed: String(seed), criticalGameOver });
			const unique = engine.state.playerTiles['player-1'].find(
				(id) => engine.state.tiles[id].number === 5,
			)!;
			const event = act(engine, (action) => action.type === 'play' && action.tileId === unique);
			expect(event.valid).toBe(false);
			expect(engine.state.lives).toBe(2);
			expect(engine.finished).toBe(criticalGameOver);
			expect(engine.state.finishedReason).toBe(
				criticalGameOver ? HanabiFinishedReason.DiscardedFatalTile : null,
			);
		}
	});

	it('replays a complete transcript deterministically without sharing mutable objects', () => {
		const original = game({ ruleSet: 'black-powder' });
		exhaustWithoutPlaying(original);
		const transcript = original.transcript();
		const replay = new BenchGame(transcript.options);
		for (const event of transcript.events) {
			const action = replay
				.legalActions(event.playerId)
				.find((candidate) => JSON.stringify(candidate.action) === JSON.stringify(event.action))!;
			expect(replay.apply(event.playerId, action.id)).toEqual(event);
		}
		expect(replay.transcript()).toEqual(transcript);
		transcript.events[0].postTurn.clues = -1;
		transcript.initialState.lives = 0;
		expect(original.transcript().events[0].postTurn.clues).toBe(7);
		expect(original.transcript().initialState.lives).toBe(3);
	});
});

describe('BenchGame fixed hand order', () => {
	it.each(['play', 'discard'] as const)(
		'keeps remaining cards in acquisition order and appends the draw after %s',
		(type) => {
			const engine = game();
			act(engine, (action) => action.type === 'clue' && action.to === 'player-2');
			const before = engine.observe('player-2').hands.find((hand) => hand.playerId === 'player-2')!;
			const removedId = before.cards[2].id;
			const event = act(engine, (action) => action.type === type && action.tileId === removedId);
			const replacementId = event.drawnCard!.id;
			const expectedIds = [
				...before.cards.map((card) => card.id).filter((id) => id !== removedId),
				replacementId,
			];
			for (const playerId of engine.state.turnOrder) {
				const hand = engine
					.observe(playerId)
					.hands.find((candidate) => candidate.playerId === 'player-2')!;
				expect(hand.cards.map((card) => card.id)).toEqual(expectedIds);
				for (const card of hand.cards.slice(0, -1))
					expect(card.clues).toEqual(before.cards.find((old) => old.id === card.id)!.clues);
				expect(hand.cards.at(-1)!.clues).toEqual({ colors: [], numbers: [] });
				if (playerId === 'player-2')
					expect(hand.cards.every((card) => card.face === null)).toBe(true);
				else expect(hand.cards.at(-1)!.face).toEqual(event.drawnCard!.face);
			}
			const ordinals = expectedIds.map((id) => Number(id.slice('card-'.length)));
			expect(ordinals).toEqual([...ordinals].sort((a, b) => a - b));
			expect(ordinals.at(-1)).toBeGreaterThan(Math.max(...ordinals.slice(0, -1)));
			expect(engine.observe('player-1', 1).events).toEqual([event]);
		},
	);

	it('has no movement API or positional information in player observations', () => {
		const engine = game({ allowDragging: false });
		const observation = engine.observe('player-1');
		expect(observation.version).toBe(1);
		expect(engine.transcript().version).toBe(1);
		expect(observation).not.toHaveProperty('revision');
		expect(observation).not.toHaveProperty('tilePositions');
		expect(observation).not.toHaveProperty('allowDragging');
		for (const hand of observation.hands)
			expect(Object.keys(hand).sort()).toEqual(['cards', 'playerId']);
		expect(engine).not.toHaveProperty('arrange');
		expect(engine).not.toHaveProperty('validateArrangement');
		expect(engine).not.toHaveProperty('revision');
		expect(engine.rules()).toContain('Players cannot rearrange cards');
		expect(engine.rules()).toContain('highest card-ID ordinal');
	});

	it('rejects configurations that enable movement', () => {
		for (const allowDragging of [true, 'true', 1, null])
			expect(() => game({ allowDragging: allowDragging as false })).toThrow('no card movement');
	});
});

class TestSocketManager {
	readonly onMessage = new PubSub<{ userId: string | undefined; message: HanabiMessage }>();
	readonly onAuthenticate = new PubSub<{ userId: string }>();
	readonly onDisconnect = new PubSub<{ userId: string }>();
	send() {}
}

function comparable(data: HanabiGameData) {
	return {
		stage: data.stage,
		finishedReason: data.finishedReason,
		currentPlayerId: data.currentPlayerId,
		remainingTurns: data.remainingTurns,
		clues: data.clues,
		lives: data.lives,
		remainingTiles: data.remainingTiles,
		playedTiles: data.playedTiles,
		discardedTiles: data.discardedTiles,
		playerTiles: data.playerTiles,
		tileNotes: data.tileNotes,
	};
}

describe('BenchGame website engine parity', () => {
	it.each(HANABI_RULE_SETS)(
		'matches real server transitions for %s across seat counts and endings',
		async (ruleSet) => {
			for (const playerCount of [2, 3, 4, 5]) {
				for (const strategy of ['discard', 'play', 'oracle'] as const) {
					for (const criticalGameOver of [false, true]) {
						const engine = game({
							seed: `${ruleSet}:${playerCount}:${strategy}`,
							playerCount,
							ruleSet,
							criticalGameOver,
						});
						const sockets = new TestSocketManager();
						const server = new HanabiGame(
							{
								id: 'bench-parity',
								code: 'bench',
								creatorId: 'player-1',
								created: '2026-01-01T00:00:00.000Z',
								updated: '2026-01-01T00:00:00.000Z',
								data: engine.state,
							},
							sockets as unknown as ServerSocketManager,
							{
								saveGame: vi.fn().mockResolvedValue(undefined),
								deleteGame: vi.fn().mockResolvedValue(undefined),
							},
						);
						try {
							while (!engine.finished) {
								const before = engine.state;
								const playerId = before.currentPlayerId!;
								const choices = engine.legalActions(playerId);
								const serialized = JSON.parse(server.serialize()!) as HanabiGameSerialized;
								expect(choices).toEqual(getBotLegalActions(serialized.data, playerId));
								const validPlay = choices.find(({ action }) => {
									if (action.type !== 'play') return false;
									const tile = before.tiles[action.tileId];
									const built = before.playedTiles.filter(
										(id) => before.tiles[id].color === tile.color,
									).length;
									return getHanabiFireworkSequence(tile.color)[built] === tile.number;
								});
								const choice =
									(strategy === 'oracle' ? validPlay : undefined) ??
									choices.find(({ action }) =>
										strategy === 'play'
											? action.type === 'play'
											: before.clues < 8
												? action.type === 'discard'
												: action.type === 'clue',
									)!;
								const { action } = choice;
								const scope = getScope(server.title, server.id);
								const message: HanabiMessage =
									action.type === 'clue'
										? { scope, type: 'GiveClueMessage', data: action }
										: {
												scope,
												type: action.type === 'play' ? 'PlayTileMessage' : 'DiscardTileMessage',
												data: { id: action.tileId },
											};
								sockets.onMessage.emit({ userId: playerId, message });
								engine.apply(playerId, choice.id);
								const after = JSON.parse(server.serialize()!) as HanabiGameSerialized;
								expect(comparable(engine.state)).toEqual(comparable(after.data));
								expect(engine.turn).toBeLessThan(200);
							}
						} finally {
							server.cleanUp();
							await server.flushSaves();
						}
					}
				}
			}
		},
		// Each variant exercises 24 complete games against the real server.
		30_000,
	);
});
