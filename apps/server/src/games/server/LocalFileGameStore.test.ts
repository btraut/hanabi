import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Game from './Game.js';
import LocalFileGameStore from './LocalFileGameStore.js';

class TestGame extends Game {
	public value: string;

	public get title(): string {
		return 'Test';
	}

	constructor(value: string, store: LocalFileGameStore) {
		super('creator', store);
		this.value = value;
	}

	public serialize(): string {
		return this.value;
	}
}

const temporaryDirectories: string[] = [];

afterEach(async () => {
	await Promise.all(
		temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })),
	);
});

describe('LocalFileGameStore', () => {
	it('creates nested directories and atomically replaces game data', async () => {
		const temporaryDirectory = await mkdtemp(join(tmpdir(), 'hanabi-store-'));
		temporaryDirectories.push(temporaryDirectory);
		const savedGamesPath = join(temporaryDirectory, 'nested', 'saved-games');
		const store = new LocalFileGameStore(savedGamesPath);
		const game = new TestGame('first', store);

		await store.saveGame(game);
		game.value = 'second';
		await store.saveGame(game);

		const gameDirectory = join(savedGamesPath, game.title);
		expect(await readFile(join(gameDirectory, game.id), 'utf8')).toBe('second');
		expect(await readdir(gameDirectory)).toEqual([game.id]);
	});

	it('ignores abandoned temporary files while restoring games', async () => {
		const temporaryDirectory = await mkdtemp(join(tmpdir(), 'hanabi-store-'));
		temporaryDirectories.push(temporaryDirectory);
		const store = new LocalFileGameStore(temporaryDirectory);
		const game = new TestGame('saved', store);
		await store.saveGame(game);
		const gameDirectory = join(temporaryDirectory, game.title);
		await import('node:fs/promises').then(({ writeFile }) =>
			writeFile(join(gameDirectory, `${game.id}.orphan.tmp`), 'partial'),
		);

		await expect(store.loadGameData()).resolves.toEqual({ Test: ['saved'] });
	});
});
