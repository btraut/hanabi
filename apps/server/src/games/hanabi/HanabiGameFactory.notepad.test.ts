import { createHash } from 'node:crypto';
import {
	generateHanabiGameData,
	generatePlayer,
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
import { appendBotHistory, createBotHistory } from './bots/BotHistory.js';
import { getBotNotepadCheckpoint, MAX_BOT_NOTE_LENGTH } from './bots/BotNotepad.js';
import { createBotPolicy, createRoundBotPolicy, type BotPolicy } from './bots/BotPolicy.js';

const games: HanabiGame[] = [];

afterEach(() => {
	for (const game of games.splice(0)) {
		game.stopSaving();
		game.cleanUp();
	}
});

function fixture(): HanabiGameSerialized {
	const data = generateHanabiGameData({
		seed: 'notepad-round',
		stage: HanabiStage.Playing,
		currentPlayerId: 'human',
		players: {
			human: generatePlayer({ id: 'human', name: 'Human' }),
			'bot:one': generatePlayer({ id: 'bot:one', name: 'Bot 1', kind: 'bot' }),
			'bot:two': generatePlayer({ id: 'bot:two', name: 'Bot 2', kind: 'bot' }),
		},
		turnOrder: ['human', 'bot:one', 'bot:two'],
		tiles: {
			a: { id: 'a', color: 'red', number: 1 },
			b: { id: 'b', color: 'blue', number: 2 },
			c: { id: 'c', color: 'green', number: 3 },
			d: { id: 'd', color: 'white', number: 4 },
		},
		playerTiles: { human: ['a'], 'bot:one': ['b'], 'bot:two': ['c'] },
		remainingTiles: ['d'],
		tilePositions: {
			a: { x: 10, y: 10, z: 0 },
			b: { x: 10, y: 10, z: 0 },
			c: { x: 10, y: 10, z: 0 },
		},
	});
	let history = createBotHistory(data, 2);
	const before = structuredClone(data);
	data.clues = 7;
	data.currentPlayerId = 'bot:one';
	const appended = appendBotHistory(
		history,
		{
			id: 'clue',
			type: HanabiGameActionType.GiveNumberClue,
			playerId: 'human',
			recipientId: 'bot:two',
			number: 3,
			tiles: [data.tiles.c],
		},
		data,
		before,
	);
	if (appended.version !== 2) throw new Error('Expected v2');
	history = appended;
	const point = getBotNotepadCheckpoint(history);
	return {
		id: 'game-id',
		code: 'NOTES',
		creatorId: 'human',
		created: '2026-09-04T12:00:00Z',
		updated: '2026-09-04T12:00:00Z',
		data,
		botRound: {
			version: 2,
			roundId: data.seed,
			policy: createRoundBotPolicy(createBotPolicy('test-model', 'Test conventions'), data),
			history,
			revision: 1,
			attempts: 1,
			tokens: 10,
			status: 'ready',
			lastAttemptAt: 0,
			pendingClues: [],
			notepads: {
				'bot:two': {
					version: 1,
					entries: [
						{
							decisionId: 'decision-1',
							opportunity: 'clue',
							observedAt: point,
							recordedAt: point,
							sourceClueEventIds: ['event-1'],
							explanation: 'I am leaving my card in the queue while I wait for another clue.',
							notes: 'The 3 clue may be a save; it does not establish a suit.',
						},
					],
				},
			},
		},
	};
}

function hydrate(value: HanabiGameSerialized | string) {
	const factory = new HanabiGameFactory();
	const sockets = {
		onMessage: new PubSub<{ userId: string | undefined; message: HanabiMessage }>(),
		onAuthenticate: new PubSub(),
		onDisconnect: new PubSub(),
		send: vi.fn(),
	} as unknown as ServerSocketManager;
	const game = factory.hydrate(typeof value === 'string' ? value : JSON.stringify(value), sockets, {
		saveGame: vi.fn().mockResolvedValue(undefined),
		deleteGame: vi.fn().mockResolvedValue(undefined),
	});
	games.push(game);
	return JSON.parse(game.serialize()!) as HanabiGameSerialized;
}

function legacyV2Policy(policy: BotPolicy): BotPolicy {
	const { hash: _hash, notepadVersion: _notepadVersion, ...identity } = policy;
	const hash = createHash('sha256')
		.update(
			JSON.stringify(identity, (_key, value: unknown) =>
				value && typeof value === 'object' && !Array.isArray(value)
					? Object.fromEntries(
							Object.entries(value).sort(([a], [b]) => (a === b ? 0 : a < b ? -1 : 1)),
						)
					: value,
			),
		)
		.digest('hex');
	return { ...identity, hash };
}

describe('HanabiGameFactory private notepads', () => {
	it('restores exact private entries and permits lazy initialization', () => {
		const value = fixture();
		expect(hydrate(value).botRound?.notepads).toEqual(value.botRound?.notepads);
		delete value.botRound!.notepads;
		expect(hydrate(value).botRound?.notepads).toBeUndefined();
	});

	it('roundtrips notepads larger than both base-save caps without truncating entries', () => {
		const value = fixture();
		const notepad = value.botRound!.notepads!['bot:two'];
		const entry = notepad.entries[0];
		notepad.entries = Array.from({ length: 2_100 }, (_, index) => ({
			...entry,
			decisionId: `note-${index}`,
			notes: 'n'.repeat(MAX_BOT_NOTE_LENGTH),
		}));
		const serialized = JSON.stringify(value);
		expect(Buffer.byteLength(serialized)).toBeGreaterThan(16 * 1024 * 1024);
		const restored = hydrate(serialized);
		expect(restored.botRound?.notepads?.['bot:two'].entries).toHaveLength(2_100);
		expect(restored.botRound?.notepads?.['bot:two'].entries.at(-1)?.notes).toHaveLength(
			MAX_BOT_NOTE_LENGTH,
		);
	});

	it('validates every queued result against its bot action history', () => {
		for (const pending of [
			{ playerId: 'bot:one', eventId: 'missing' },
			{ playerId: 'bot:two', eventId: 'event-1' },
			{ playerId: 'human', eventId: 'event-1' },
		]) {
			const value = fixture();
			value.botRound!.pendingResults = [pending];
			expect(() => hydrate(value)).toThrow(
				'pending result must reference an unprocessed play or discard',
			);
		}
	});

	it('retains ordinary envelope size limits alongside a valid notepad', () => {
		const value = fixture();
		expect(() =>
			hydrate(JSON.stringify({ ...value, unrelatedPayload: 'x'.repeat(2 * 1024 * 1024) })),
		).toThrow('normalized persisted data exceeds');
	});

	it('rejects notepads for unenabled saved policies and preserves missing legacy notebooks', () => {
		const value = fixture();
		value.botRound!.policy = legacyV2Policy(value.botRound!.policy);
		expect(() => hydrate(value)).toThrow('botRound');
		delete value.botRound!.notepads;
		const restored = hydrate(value);
		expect(restored.botRound?.policy).toEqual(value.botRound?.policy);
		expect(restored.botRound?.notepads).toBeUndefined();
	});

	it('rejects swapped notebooks, human owners, invalid sources, duplicates and serialized extras', () => {
		for (const corrupt of [
			(value: HanabiGameSerialized) => {
				value.botRound!.notepads = { 'bot:one': value.botRound!.notepads!['bot:two'] };
			},
			(value: HanabiGameSerialized) => {
				value.botRound!.notepads = { human: value.botRound!.notepads!['bot:two'] };
			},
			(value: HanabiGameSerialized) => {
				value.botRound!.notepads!['bot:two'].entries[0].sourceClueEventIds = ['missing'];
			},
			(value: HanabiGameSerialized) => {
				const entries = value.botRound!.notepads!['bot:two'].entries;
				entries.push(structuredClone(entries[0]));
			},
			(value: HanabiGameSerialized) => {
				Object.assign(value.botRound!.notepads!['bot:two'].entries[0], {
					hiddenObservation: 'private',
				});
			},
		]) {
			const value = fixture();
			corrupt(value);
			expect(() => hydrate(value)).toThrow('botRound');
		}
	});
});
