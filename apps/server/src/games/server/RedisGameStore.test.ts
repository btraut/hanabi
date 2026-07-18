import { describe, expect, it, vi } from 'vitest';
import Game from './Game.js';
import RedisGameStore from './RedisGameStore.js';
import RedisClient from '../../utils/RedisClient.js';

class TestGame extends Game {
	public get title(): string {
		return 'Test';
	}

	public serialize(): string {
		return this.id;
	}
}

function createRedisClient() {
	const data = new Map<string, string>();
	const sets = new Map<string, Set<string>>();
	const getMany = vi.fn((keys: string[]) =>
		Promise.resolve(keys.map((key) => data.get(key) ?? null)),
	);
	return {
		data,
		sets,
		getMany,
		client: {
			get: vi.fn((key: string) => Promise.resolve(data.get(key) ?? null)),
			getMany,
			set: vi.fn(async (key: string, value: string) => {
				await Promise.resolve();
				data.set(key, value);
			}),
			del: vi.fn((key: string) => {
				data.delete(key);
				return Promise.resolve();
			}),
			saveGameRecord: vi.fn(
				(
					key: string,
					value: string,
					setKey: string,
					setMember: string,
					legacyKey: string,
					title: string,
					id: string,
				) => {
					data.set(key, value);
					const members = sets.get(setKey) ?? new Set<string>();
					members.add(setMember);
					sets.set(setKey, members);
					const legacy = JSON.parse(data.get(legacyKey) ?? '{}') as Record<string, string[]>;
					legacy[title] = [...new Set([...(legacy[title] ?? []), id])];
					data.set(legacyKey, JSON.stringify(legacy));
					return Promise.resolve();
				},
			),
			deleteGameRecord: vi.fn(
				(
					key: string,
					setKey: string,
					setMember: string,
					legacyKey: string,
					title: string,
					id: string,
				) => {
					data.delete(key);
					sets.get(setKey)?.delete(setMember);
					const legacy = JSON.parse(data.get(legacyKey) ?? '{}') as Record<string, string[]>;
					legacy[title] = (legacy[title] ?? []).filter((candidate) => candidate !== id);
					if (legacy[title].length === 0) delete legacy[title];
					data.set(legacyKey, JSON.stringify(legacy));
					return Promise.resolve();
				},
			),
			setMembers: vi.fn((key: string) => Promise.resolve([...new Set(sets.get(key))])),
			disconnect: vi.fn(() => Promise.resolve()),
		} as unknown as RedisClient,
	};
}

describe('RedisGameStore', () => {
	it('uses atomic record and index mutations without losing game ids', async () => {
		const { client, data, sets } = createRedisClient();
		const store = new RedisGameStore(client);
		const first = new TestGame('creator', store);
		const second = new TestGame('creator', store);

		await Promise.all([store.saveGame(first), store.saveGame(second)]);

		expect(sets.get('gameData.__index__')).toEqual(
			new Set([`gameData.Test.${first.id}`, `gameData.Test.${second.id}`]),
		);
		expect(JSON.parse(data.get('gameData.__all__') ?? '{}')).toEqual({
			Test: [first.id, second.id],
		});

		await Promise.all([store.deleteGame(first), store.saveGame(second)]);
		expect(sets.get('gameData.__index__')).toEqual(new Set([`gameData.Test.${second.id}`]));
		expect(JSON.parse(data.get('gameData.__all__') ?? '{}')).toEqual({ Test: [second.id] });
	});

	it('loads legacy index entries alongside the atomic set index', async () => {
		const { client, data, getMany } = createRedisClient();
		const store = new RedisGameStore(client);
		const legacy = new TestGame('creator', store);
		data.set('gameData.__all__', JSON.stringify({ Test: [legacy.id] }));
		data.set(`gameData.Test.${legacy.id}`, legacy.serialize());

		await expect(store.loadGameData()).resolves.toEqual({ Test: [legacy.serialize()] });
		expect(getMany).toHaveBeenCalledOnce();
	});
});
