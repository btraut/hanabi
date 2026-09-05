import {
	generateHanabiGameData,
	generatePlayer,
	HanabiFinishedReason,
	HanabiGameActionType,
	HanabiStage,
	PubSub,
	type HanabiMessage,
} from '@hanabi/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type ServerSocketManager from '../../utils/SocketManager.js';
import type HanabiGame from './HanabiGame.js';
import type { HanabiGameSerialized } from './HanabiGame.js';
import HanabiGameFactory from './HanabiGameFactory.js';
import {
	appendBotArrangement,
	appendBotHistory,
	createBotHistory,
	type BotHistoryArrangement,
} from './bots/BotHistory.js';
import { createBotPolicy, createRoundBotPolicy } from './bots/BotPolicy.js';

const games: HanabiGame[] = [];

afterEach(() => {
	for (const game of games.splice(0)) {
		game.stopSaving();
		game.cleanUp();
	}
});

function serialized(): HanabiGameSerialized {
	const ids = Array.from({ length: 5 }, (_, index) => `bot-card-${index}-${'a'.repeat(30)}`);
	const colors = ['red', 'blue', 'green', 'yellow', 'white'] as const;
	const tiles = Object.fromEntries(
		ids.map((id, index) => [id, { id, color: colors[index], number: 1 as const }]),
	);
	const data = generateHanabiGameData({
		seed: 'round-id',
		stage: HanabiStage.Playing,
		currentPlayerId: 'human',
		players: {
			human: generatePlayer({ id: 'human', name: 'Human' }),
			'bot:one': generatePlayer({ id: 'bot:one', name: 'Bot', kind: 'bot' }),
		},
		turnOrder: ['human', 'bot:one'],
		tiles: {
			...tiles,
			humanCard: { id: 'humanCard', color: 'blue', number: 2 },
			deck: { id: 'deck', color: 'green', number: 3 },
		},
		playerTiles: { human: ['humanCard'], 'bot:one': ids },
		remainingTiles: ['deck'],
		tilePositions: {
			...Object.fromEntries(
				ids.map((id, index) => [id, { x: 10 + index * 50, y: 10, z: 0 }] as const),
			),
			humanCard: { x: 10, y: 10, z: 0 },
		},
	});
	return {
		id: 'game-id',
		code: 'ABCDEF',
		creatorId: 'human',
		created: '2026-09-04T12:00:00Z',
		updated: '2026-09-04T12:00:00Z',
		data,
		botRound: {
			version: 2,
			roundId: data.seed,
			policy: createRoundBotPolicy(createBotPolicy('test-model', 'Test coaching'), data),
			history: createBotHistory(data, 2),
			revision: 0,
			attempts: 0,
			tokens: 0,
			status: 'ready',
			lastAttemptAt: 0,
			pendingClues: [],
		},
	};
}

function hydrate(value: string | HanabiGameSerialized): HanabiGame {
	const factory = new HanabiGameFactory();
	const socketManager = {
		onMessage: new PubSub<{ userId: string | undefined; message: HanabiMessage }>(),
		onAuthenticate: new PubSub(),
		onDisconnect: new PubSub(),
		send: vi.fn(),
	} as unknown as ServerSocketManager;
	const game = factory.hydrate(
		typeof value === 'string' ? value : JSON.stringify(value),
		socketManager,
		{
			saveGame: vi.fn().mockResolvedValue(undefined),
			deleteGame: vi.fn().mockResolvedValue(undefined),
		},
	);
	games.push(game);
	return game;
}

function addClue(value: HanabiGameSerialized): void {
	const before = structuredClone(value.data);
	value.data.clues -= 1;
	value.data.currentPlayerId = 'bot:one';
	const round = value.botRound!;
	round.history = appendBotHistory(
		round.history,
		{
			id: 'clue-action',
			type: HanabiGameActionType.GiveNumberClue,
			playerId: 'human',
			recipientId: 'bot:one',
			number: 1,
			tiles: value.data.playerTiles['bot:one'].map((id) => value.data.tiles[id]),
		},
		value.data,
		before,
	);
	round.pendingClues = [{ playerId: 'bot:one', eventIds: ['event-1'] }];
}

describe('HanabiGameFactory full bot histories', () => {
	it('restores a valid history beyond both legacy size caps without truncating events', () => {
		const value = serialized();
		const round = value.botRound!;
		if (round.history.version !== 2) throw new Error('Expected v2');
		const ids = value.data.playerTiles['bot:one'];
		const upper = ids.map((tileId) => ({ tileId, position: value.data.tilePositions[tileId] }));
		const lower = upper.map((card, index) => ({
			...card,
			position: { x: index * 50, y: 80, z: index },
		}));
		const eventCount = 20_000;
		round.history.events = Array.from(
			{ length: eventCount },
			(_, index): BotHistoryArrangement => ({
				type: 'arrangement',
				eventId: `event-${index + 1}`,
				sequence: index + 1,
				turnIndex: 0,
				actorId: 'bot:one',
				before: index % 2 === 0 ? upper : lower,
				after: index % 2 === 0 ? lower : upper,
				changedTileIds: ids,
			}),
		);
		const text = JSON.stringify(value);
		expect(Buffer.byteLength(text)).toBeGreaterThan(16 * 1024 * 1024);
		const game = hydrate(text);
		const restored = JSON.parse(game.serialize()!) as HanabiGameSerialized;
		expect(restored.botRound?.history.version).toBe(2);
		if (restored.botRound?.history.version !== 2) throw new Error('Expected v2');
		expect(restored.botRound.history.events).toHaveLength(eventCount);
		expect(restored.botRound.history.events.at(-1)?.eventId).toBe(`event-${eventCount}`);
		expect(restored.botRound.history.layoutHistoryComplete).toBe(true);
	}, 20_000);

	it('keeps both ordinary-envelope caps for v2 saves', () => {
		const value = serialized();
		const oversized = { ...value, unrelatedPayload: 'x'.repeat(2 * 1024 * 1024) };
		expect(() => hydrate(JSON.stringify(oversized))).toThrow('normalized persisted data exceeds');
		oversized.unrelatedPayload = 'x'.repeat(16 * 1024 * 1024);
		expect(() => hydrate(JSON.stringify(oversized))).toThrow('persisted data exceeds');
	});

	it('preserves v1 policies and their existing size limits', () => {
		const value = serialized();
		value.botRound = {
			...value.botRound!,
			version: 1,
			history: createBotHistory(value.data),
			policy: createBotPolicy('legacy-model', 'Legacy coaching'),
		};
		delete value.botRound.pendingClues;
		const restored = JSON.parse(hydrate(value).serialize()!) as HanabiGameSerialized;
		expect(restored.botRound?.policy).toEqual(value.botRound.policy);
		expect(restored.botRound?.history).toEqual(value.botRound.history);
		expect(() =>
			hydrate(JSON.stringify({ ...value, unrelatedPayload: 'x'.repeat(2 * 1024 * 1024) })),
		).toThrow('normalized persisted data exceeds');
		expect(() =>
			hydrate(JSON.stringify({ ...value, unrelatedPayload: 'x'.repeat(16 * 1024 * 1024) })),
		).toThrow('persisted data exceeds');
	});

	it('restores an actual pending clue and its subsequent committed layout', () => {
		const value = serialized();
		addClue(value);
		expect(
			(JSON.parse(hydrate(value).serialize()!) as HanabiGameSerialized).botRound?.pendingClues,
		).toEqual([{ playerId: 'bot:one', eventIds: ['event-1'] }]);
		const before = value.data.tilePositions;
		const tileId = value.data.playerTiles['bot:one'][0];
		value.data.tilePositions = { ...before, [tileId]: { x: 20, y: 80, z: 1 } };
		value.botRound!.history = appendBotArrangement(
			value.botRound!.history,
			'bot:one',
			before,
			value.data,
			'event-1',
		);
		value.botRound!.pendingClues = [];
		expect(
			(JSON.parse(hydrate(value).serialize()!) as HanabiGameSerialized).data.tilePositions[tileId],
		).toEqual({ x: 20, y: 80, z: 1 });
	});

	it('rejects pending references to missing clues, non-clue events, and other recipients', () => {
		const value = serialized();
		addClue(value);
		value.botRound!.pendingClues![0].eventIds = ['missing'];
		expect(() => hydrate(value)).toThrow('pending clues must reference actual clues');
		value.botRound!.pendingClues = [{ playerId: 'human', eventIds: ['event-1'] }];
		expect(() => hydrate(value)).toThrow('pending clues must reference actual clues');
		const before = value.data.tilePositions;
		const tileId = value.data.playerTiles['bot:one'][0];
		value.data.tilePositions = { ...before, [tileId]: { x: 20, y: 80, z: 1 } };
		value.botRound!.history = appendBotArrangement(
			value.botRound!.history,
			'bot:one',
			before,
			value.data,
		);
		value.botRound!.pendingClues = [{ playerId: 'bot:one', eventIds: ['event-2'] }];
		expect(() => hydrate(value)).toThrow('pending clues must reference actual clues');
	});

	it('rejects inconsistent saved rules, resources, card identities, hands, and layout', () => {
		for (const corrupt of [
			(value: HanabiGameSerialized) => {
				value.data.showNotes = false;
			},
			(value: HanabiGameSerialized) => {
				value.data.clues = 7;
			},
			(value: HanabiGameSerialized) => {
				value.data.tiles[value.data.playerTiles['bot:one'][0]].number = 2;
			},
			(value: HanabiGameSerialized) => {
				value.data.playerTiles['bot:one'].reverse();
			},
			(value: HanabiGameSerialized) => {
				value.data.tilePositions[value.data.playerTiles['bot:one'][0]].x = 123;
			},
		]) {
			const value = serialized();
			corrupt(value);
			expect(() => hydrate(value)).toThrow('botRound');
		}
	});

	it('rejects fabricated clue context or touched-card evidence in an otherwise valid record', () => {
		const context = serialized();
		addClue(context);
		const history = context.botRound!.history;
		if (history.version !== 2 || history.events[0].type !== 'clue')
			throw new Error('Expected clue');
		history.events[0].beforeState!.clues = 3;
		expect(() => hydrate(context)).toThrow('clue context does not match');
		const evidence = serialized();
		addClue(evidence);
		const wrongHistory = evidence.botRound!.history;
		if (wrongHistory.version !== 2) throw new Error('Expected v2');
		const ids = evidence.data.playerTiles['bot:one'];
		for (const record of [wrongHistory.moves[0], wrongHistory.events[0]]) {
			if (record.type !== 'clue') throw new Error('Expected clue');
			record.touchedTileIds = [ids[0]];
			record.untouchedTileIds = ids.slice(1);
		}
		expect(() => hydrate(evidence)).toThrow('clue evidence does not match');
	});

	it('preserves an honest incomplete-layout marker without inventing missing movements', () => {
		const value = serialized();
		const history = value.botRound!.history;
		if (history.version !== 2) throw new Error('Expected v2');
		history.complete = false;
		history.layoutHistoryComplete = false;
		value.data.tilePositions[value.data.playerTiles['bot:one'][0]].x = 123;
		const restored = JSON.parse(hydrate(value).serialize()!) as HanabiGameSerialized;
		expect(restored.botRound?.history).toMatchObject({
			complete: false,
			turnHistoryComplete: true,
			layoutHistoryComplete: false,
			events: [],
		});
	});

	it('clears previously queued work when another accepted action finished the game', () => {
		const value = serialized();
		addClue(value);
		value.data.stage = HanabiStage.Finished;
		value.data.finishedReason = HanabiFinishedReason.OutOfTurns;
		value.data.remainingTurns = 0;
		const history = value.botRound!.history;
		if (history.version !== 2) throw new Error('Expected v2');
		for (const record of [history.moves[0], history.events[0]]) {
			if (record.type === 'arrangement') continue;
			record.postTurn = {
				...record.postTurn,
				stage: HanabiStage.Finished,
				finishedReason: HanabiFinishedReason.OutOfTurns,
				remainingTurns: 0,
			};
		}
		expect(
			(JSON.parse(hydrate(value).serialize()!) as HanabiGameSerialized).botRound?.pendingClues,
		).toEqual([]);
	});
});
