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
	return {
		data,
		client: {
			get: vi.fn((key: string) => Promise.resolve(data.get(key) ?? null)),
			set: vi.fn(async (key: string, value: string) => {
				await Promise.resolve();
				data.set(key, value);
			}),
			del: vi.fn((key: string) => {
				data.delete(key);
				return Promise.resolve();
			}),
			disconnect: vi.fn(() => Promise.resolve()),
		} as unknown as RedisClient,
	};
}

describe('RedisGameStore', () => {
	it('serializes concurrent index mutations without losing game ids', async () => {
		const { client, data } = createRedisClient();
		const store = new RedisGameStore(client);
		const first = new TestGame('creator', store);
		const second = new TestGame('creator', store);

		await Promise.all([store.saveGame(first), store.saveGame(second)]);

		expect(JSON.parse(data.get('gameData.__all__') ?? '{}')).toEqual({
			Test: [first.id, second.id],
		});

		await Promise.all([store.deleteGame(first), store.saveGame(second)]);
		expect(JSON.parse(data.get('gameData.__all__') ?? '{}')).toEqual({ Test: [second.id] });
	});
});
