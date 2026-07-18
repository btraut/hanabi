import { describe, expect, it, vi } from 'vitest';
import { GameManagerMessage } from '@hanabi/shared';
import GameManager from './GameManager.js';
import Game from './Game.js';
import { GameStore, SaveGameDelegate } from './GameStore.js';
import SocketManager from '../../utils/SocketManager.js';

class TestGame extends Game {
	public cleanedUp = false;

	public get title(): string {
		return 'Test';
	}

	public serialize(): string {
		return '{}';
	}

	public update(): void {
		this._update();
	}

	public cleanUp(): void {
		this.cleanedUp = true;
	}
}

function createSocketManager(): SocketManager<GameManagerMessage> {
	return {
		addScopedMessageHandler: vi.fn(() => 1),
		onMessage: { unsubscribe: vi.fn() },
	} as unknown as SocketManager<GameManagerMessage>;
}

function createStore(overrides: Partial<GameStore> = {}): GameStore {
	return {
		saveGame: vi.fn(() => Promise.resolve()),
		deleteGame: vi.fn(() => Promise.resolve()),
		loadGameData: vi.fn(() => Promise.resolve({})),
		close: vi.fn(() => Promise.resolve()),
		...overrides,
	};
}

function addGame(manager: GameManager, game: Game): void {
	(manager as unknown as { _games: Record<string, Game> })._games[game.id] = game;
}

describe('GameManager shutdown persistence', () => {
	it('waits for a final save before cleaning up and deleting a removed game', async () => {
		let releaseSave: (() => void) | undefined;
		let saveStarted: (() => void) | undefined;
		const saving = new Promise<void>((resolve) => {
			releaseSave = resolve;
		});
		const started = new Promise<void>((resolve) => {
			saveStarted = resolve;
		});
		const events: string[] = [];
		const store = createStore({
			saveGame: vi.fn(async () => {
				events.push('save');
				saveStarted?.();
				await saving;
			}),
			deleteGame: vi.fn(() => {
				events.push('delete');
				return Promise.resolve();
			}),
		});
		const game = new TestGame('creator', store);
		const originalCleanUp = game.cleanUp.bind(game);
		game.cleanUp = () => {
			events.push('cleanup');
			originalCleanUp();
		};
		const manager = new GameManager(createSocketManager(), store);
		addGame(manager, game);

		game.update();
		await started;
		manager._removeGame(game.id);
		expect(events).toEqual(['save']);

		releaseSave?.();
		await manager.close();

		expect(events).toEqual(['save', 'cleanup', 'delete']);
		expect(store.close).toHaveBeenCalledOnce();
	});

	it('always cleans up games and closes the store before reporting aggregate failures', async () => {
		const saveError = new Error('save failed');
		const closeError = new Error('close failed');
		const delegate: SaveGameDelegate = {
			saveGame: vi.fn(() => Promise.reject(saveError)),
			deleteGame: vi.fn(() => Promise.resolve()),
		};
		const store = createStore({
			close: vi.fn(() => Promise.reject(closeError)),
		});
		const game = new TestGame('creator', delegate);
		const manager = new GameManager(createSocketManager(), store);
		addGame(manager, game);
		game.update();

		const closePromise = manager.close();
		await expect(closePromise).rejects.toMatchObject({
			name: 'AggregateError',
			errors: [saveError, closeError],
		});
		expect(game.cleanedUp).toBe(true);
		expect(store.close).toHaveBeenCalledOnce();
	});

	it('captures asynchronous removal failures and reports them from close', async () => {
		const deleteError = new Error('delete failed');
		const store = createStore({
			deleteGame: vi.fn(() => Promise.reject(deleteError)),
		});
		const game = new TestGame('creator', store);
		const manager = new GameManager(createSocketManager(), store);
		addGame(manager, game);

		manager._removeGame(game.id);

		await expect(manager.close()).rejects.toMatchObject({ name: 'AggregateError' });
		expect(game.cleanedUp).toBe(true);
		expect(store.close).toHaveBeenCalledOnce();
	});
});
