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
	const { hash: _hash, ...identity } = policy;
	const conventions =
		"Custom coaching. Preserve those reservations in your notepad and interpret teammates' hands the same way.";
	const legacy = {
		...identity,
		notepadVersion: 1,
		conventions,
		conventionsVersion: createHash('sha256').update(conventions).digest('hex'),
		instructions: `Saved rules. Return actionId, arrangement, and explanation. Extra notes remain private to your notepad.\n\n## Private notepad\n\nReturn a notes field alongside actionId, arrangement, and explanation.\n\n## Coaching instructions\n\n${conventions}`,
	};
	const hash = createHash('sha256')
		.update(
			JSON.stringify(legacy, (_key, value: unknown) =>
				value && typeof value === 'object' && !Array.isArray(value)
					? Object.fromEntries(
							Object.entries(value).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
						)
					: value,
			),
		)
		.digest('hex');
	return { ...legacy, hash };
}

function withConversation(value: HanabiGameSerialized) {
	const round = value.botRound!;
	round.conversations = {
		'bot:two': {
			responseId: 'resp_saved',
			roundId: round.roundId,
			playerId: 'bot:two',
			policyHash: round.policy.hash,
			historyLength: 1,
			lastEventId: 'event-1',
		},
	};
	return value;
}

describe('HanabiGameFactory scratchpad removal migration', () => {
	it('discards legacy notes and conversations while retaining rules, history, and coaching', () => {
		const value = fixture();
		value.botRound!.policy = legacyV2Policy(value.botRound!.policy);
		withConversation(value);
		Object.assign(value.botRound!, {
			notepads: { 'bot:two': { version: 1, entries: [{ notes: 'Private old note' }] } },
		});
		const restored = hydrate(value);
		expect(restored.botRound).not.toHaveProperty('notepads');
		expect(restored.botRound).not.toHaveProperty('conversations');
		expect(restored.botRound?.policy).not.toHaveProperty('notepadVersion');
		expect(restored.botRound?.policy.instructions).not.toMatch(/notepad|notes field/i);
		expect(restored.botRound?.policy.instructions).toContain('Saved rules.');
		expect(restored.botRound?.policy.conventions).toBe(
			"Custom coaching. Interpret teammates' hands the same way.",
		);
		expect(restored.botRound?.policy.hash).not.toBe(value.botRound?.policy.hash);
		expect(restored.botRound?.policy.rules).toEqual(value.botRound?.policy.rules);
		expect(restored.botRound?.history).toEqual(value.botRound?.history);
		expect(hydrate(restored).botRound?.policy).toEqual(restored.botRound?.policy);
	});

	it('resets old-contract conversations even when their saved notes are absent', () => {
		const value = fixture();
		value.botRound!.policy = legacyV2Policy(value.botRound!.policy);
		expect(hydrate(withConversation(value)).botRound).not.toHaveProperty('conversations');
	});

	it('preserves current policies and compatible conversations', () => {
		const value = withConversation(fixture());
		const restored = hydrate(value);
		expect(restored.botRound?.policy).toEqual(value.botRound?.policy);
		expect(restored.botRound?.conversations).toEqual(value.botRound?.conversations);
	});

	it('discards obsolete notes larger than the old save envelope limits', () => {
		const value = fixture();
		value.botRound!.policy = legacyV2Policy(value.botRound!.policy);
		Object.assign(value.botRound!, { notepads: { notes: 'n'.repeat(17 * 1024 * 1024) } });
		expect(hydrate(value).botRound).not.toHaveProperty('notepads');
	});

	it('rejects corrupted legacy policy identity before migration', () => {
		const value = fixture();
		value.botRound!.policy = {
			...legacyV2Policy(value.botRound!.policy),
			instructions: 'tampered',
		};
		expect(() => hydrate(value)).toThrow('botRound');
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

	it('retains ordinary envelope size limits after discarding obsolete notes', () => {
		const value = fixture();
		expect(() =>
			hydrate(JSON.stringify({ ...value, unrelatedPayload: 'x'.repeat(2 * 1024 * 1024) })),
		).toThrow('normalized persisted data exceeds');
	});
});
