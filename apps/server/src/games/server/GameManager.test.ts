import { describe, expect, it, vi } from 'vitest';
import { GAME_MANAGER_SCOPE, GameManagerMessage } from '@hanabi/shared';
import GameManager, { MAX_ACTIVE_GAMES_PER_CREATOR } from './GameManager.js';
import Game from './Game.js';
import { GameStore, SaveGameDelegate } from './GameStore.js';
import SocketManager from '../../utils/SocketManager.js';
import GameFactory from './GameFactory.js';

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

	public setCode(code: string): void {
		this._code = code;
	}

	public setId(id: string): void {
		this._id = id;
	}
}

function createSocketManager(): SocketManager {
	return {
		addScopedMessageHandler: vi.fn(() => 1),
		sendToSocket: vi.fn(),
		onMessage: { unsubscribe: vi.fn() },
	} as unknown as SocketManager;
}

function createSocketHarness() {
	type Handler = (data: {
		abuseKey: string;
		socketId: string;
		userId: string;
		message: GameManagerMessage;
	}) => void;
	let handler: Handler | undefined;
	const sendToSocket = vi.fn();
	const socketManager = {
		addScopedMessageHandler: vi.fn((nextHandler: Handler) => {
			handler = nextHandler;
			return 1;
		}),
		sendToSocket,
		onMessage: { unsubscribe: vi.fn() },
	} as unknown as SocketManager;
	return {
		socketManager,
		sendToSocket,
		emit: (
			userId: string,
			message: GameManagerMessage,
			socketId = `${userId}-socket`,
			abuseKey = '127.0.0.1',
		) => handler?.({ abuseKey, socketId, userId, message }),
	};
}

class TestGameFactory extends GameFactory {
	public readonly created: TestGame[] = [];

	public get title(): string {
		return 'Test';
	}

	public create(
		creatorId: string,
		_socketManager: SocketManager,
		saveGameDelegate: SaveGameDelegate,
	): TestGame {
		const game = new TestGame(creatorId, saveGameDelegate);
		this.created.push(game);
		return game;
	}
}

class HydratingTestGameFactory extends TestGameFactory {
	public readonly hydrated: TestGame[] = [];

	public hydrate(
		data: string,
		_socketManager: SocketManager,
		saveGameDelegate: SaveGameDelegate,
	): TestGame {
		const parsed = JSON.parse(data) as { id: string; code: string };
		const game = new TestGame('creator', saveGameDelegate);
		game.setId(parsed.id);
		game.setCode(parsed.code);
		this.hydrated.push(game);
		return game;
	}
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
	it('rejects duplicate persisted game ids without leaking the second game', async () => {
		const store = createStore({
			loadGameData: vi.fn(() =>
				Promise.resolve({
					Test: [
						JSON.stringify({ id: 'duplicate', code: 'abdegj' }),
						JSON.stringify({ id: 'duplicate', code: 'kmnpqr' }),
					],
				}),
			),
		});
		const manager = new GameManager(createSocketManager(), store);
		const factory = new HydratingTestGameFactory();
		manager.addGameFactory(factory);

		await expect(manager.restoreGames()).rejects.toThrow('duplicate game id "duplicate"');
		expect(factory.hydrated).toHaveLength(2);
		expect(factory.hydrated[0].cleanedUp).toBe(false);
		expect(factory.hydrated[1].cleanedUp).toBe(true);

		await manager.close();
		expect(factory.hydrated[0].cleanedUp).toBe(true);
	});

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

describe('GameManager request hardening', () => {
	it('adds a requested watcher and replies only to the originating socket', () => {
		const sockets = createSocketHarness();
		const manager = new GameManager(sockets.socketManager, createStore());
		const factory = new TestGameFactory();
		manager.addGameFactory(factory);

		sockets.emit('creator', {
			scope: GAME_MANAGER_SCOPE,
			type: 'CreateGameMessage',
			data: { title: 'Test', watch: true },
		});

		expect(factory.created).toHaveLength(1);
		expect(factory.created[0].watchers).toEqual(['creator']);
		expect(sockets.sendToSocket).toHaveBeenCalledWith(
			'creator-socket',
			expect.objectContaining({ type: 'CreateGameResponseMessage' }),
		);
	});

	it('rejects malformed requests without invoking a factory', () => {
		const sockets = createSocketHarness();
		const manager = new GameManager(sockets.socketManager, createStore());
		const factory = new TestGameFactory();
		manager.addGameFactory(factory);

		sockets.emit('creator', {
			scope: GAME_MANAGER_SCOPE,
			type: 'CreateGameMessage',
			data: null,
		} as unknown as GameManagerMessage);
		sockets.emit('creator', {
			scope: GAME_MANAGER_SCOPE,
			type: 'WatchGameMessage',
			data: { code: { invalid: true } },
		} as unknown as GameManagerMessage);

		expect(factory.created).toHaveLength(0);
		expect(sockets.sendToSocket).toHaveBeenNthCalledWith(
			1,
			'creator-socket',
			expect.objectContaining({ data: { error: 'Invalid create-game request.' } }),
		);
		expect(sockets.sendToSocket).toHaveBeenNthCalledWith(
			2,
			'creator-socket',
			expect.objectContaining({ data: { error: 'Invalid game code.' } }),
		);
	});

	it('bounds active games per creator', () => {
		const sockets = createSocketHarness();
		const manager = new GameManager(sockets.socketManager, createStore());
		const factory = new TestGameFactory();
		manager.addGameFactory(factory);

		for (let index = 0; index <= MAX_ACTIVE_GAMES_PER_CREATOR; index += 1) {
			sockets.emit('creator', {
				scope: GAME_MANAGER_SCOPE,
				type: 'CreateGameMessage',
				data: { title: 'Test' },
			});
		}

		expect(factory.created).toHaveLength(MAX_ACTIVE_GAMES_PER_CREATOR);
		expect(sockets.sendToSocket).toHaveBeenLastCalledWith(
			'creator-socket',
			expect.objectContaining({
				data: { error: `You can have at most ${MAX_ACTIVE_GAMES_PER_CREATOR} active games.` },
			}),
		);
	});

	it('throttles repeated failed game-code guesses', () => {
		const sockets = createSocketHarness();
		const _manager = new GameManager(sockets.socketManager, createStore());

		for (let index = 0; index < 22; index += 1) {
			sockets.emit('guesser', {
				scope: GAME_MANAGER_SCOPE,
				type: 'WatchGameMessage',
				data: { code: '234567' },
			});
		}

		expect(sockets.sendToSocket).toHaveBeenLastCalledWith(
			'guesser-socket',
			expect.objectContaining({
				data: { error: 'Too many failed game-code attempts. Try again in a minute.' },
			}),
		);
	});

	it('shares the failed-guess budget across sessions from one address', () => {
		const sockets = createSocketHarness();
		const _manager = new GameManager(sockets.socketManager, createStore());

		for (let index = 0; index < 22; index += 1) {
			sockets.emit(`rotated-user-${index}`, {
				scope: GAME_MANAGER_SCOPE,
				type: 'WatchGameMessage',
				data: { code: '234567' },
			});
		}

		expect(sockets.sendToSocket).toHaveBeenLastCalledWith(
			'rotated-user-21-socket',
			expect.objectContaining({
				data: { error: 'Too many failed game-code attempts. Try again in a minute.' },
			}),
		);
	});

	it('does not reset failed guesses after watching a valid game', () => {
		const sockets = createSocketHarness();
		const manager = new GameManager(sockets.socketManager, createStore());
		const game = new TestGame('creator', createStore());
		game.setCode('abdegj');
		addGame(manager, game);

		for (let index = 0; index < 19; index += 1) {
			sockets.emit('guesser', {
				scope: GAME_MANAGER_SCOPE,
				type: 'WatchGameMessage',
				data: { code: '234567' },
			});
		}
		sockets.emit('guesser', {
			scope: GAME_MANAGER_SCOPE,
			type: 'WatchGameMessage',
			data: { code: 'abdegj' },
		});
		sockets.emit('guesser', {
			scope: GAME_MANAGER_SCOPE,
			type: 'WatchGameMessage',
			data: { code: '234567' },
		});
		sockets.emit('guesser', {
			scope: GAME_MANAGER_SCOPE,
			type: 'WatchGameMessage',
			data: { code: 'abdegj' },
		});

		expect(sockets.sendToSocket).toHaveBeenLastCalledWith(
			'guesser-socket',
			expect.objectContaining({
				data: { error: 'Too many failed game-code attempts. Try again in a minute.' },
			}),
		);
	});
});
