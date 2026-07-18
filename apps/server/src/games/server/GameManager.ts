import { GAME_MANAGER_SCOPE, GameManagerMessage } from '@hanabi/shared';
import Game from './Game.js';
import GameFactory from './GameFactory.js';
import { GameStore } from './GameStore.js';
import SocketManager from '../../utils/SocketManager.js';
import Logger from '../../utils/Logger.js';

export const MAX_ACTIVE_GAMES = 10_000;
export const MAX_ACTIVE_GAMES_PER_CREATOR = 10;
const MAX_FAILED_WATCH_ATTEMPTS = 20;
const FAILED_WATCH_WINDOW_MS = 60_000;
const MAX_WATCH_RATE_LIMIT_ENTRIES = 10_000;
const GAME_CREATION_CODE_ATTEMPTS = 20;

interface WatchRateLimit {
	failedAttempts: number;
	windowStartedAt: number;
}

export default class GameManager {
	private _gameFactories: { [title: string]: GameFactory } = {};
	private _games: { [id: string]: Game } = {};

	private _socketManager: SocketManager;
	private _socketManagerOnMessageSubscriptionId: number | null = null;

	private _gameStore: GameStore;
	private _pendingRemovals = new Set<Promise<void>>();
	private _removalErrors: unknown[] = [];
	private _watchRateLimits = new Map<string, WatchRateLimit>();
	private _watchAbuseRateLimits = new Map<string, WatchRateLimit>();

	constructor(socketManager: SocketManager, gameStore: GameStore) {
		this._socketManager = socketManager;
		this._socketManagerOnMessageSubscriptionId = socketManager.addScopedMessageHandler(
			this._handleMessage,
			GAME_MANAGER_SCOPE,
		);
		this._gameStore = gameStore;
	}

	public cleanUp(): void {
		if (this._socketManagerOnMessageSubscriptionId !== null) {
			this._socketManager.onMessage.unsubscribe(this._socketManagerOnMessageSubscriptionId);
		}
	}

	public async close(): Promise<void> {
		this.cleanUp();
		const games = Object.values(this._games);
		games.forEach((game) => game.stopSaving());

		const errors: unknown[] = [];
		await Promise.all(
			games.map(async (game) => {
				try {
					await game.flushSaves();
				} catch (error) {
					errors.push(error);
				}

				try {
					game.cleanUp();
				} catch (error) {
					errors.push(error);
				}
			}),
		);

		while (this._pendingRemovals.size > 0) {
			await Promise.all(this._pendingRemovals);
		}
		errors.push(...this._removalErrors);
		this._removalErrors = [];

		try {
			await this._gameStore.close();
		} catch (error) {
			errors.push(error);
		}

		if (errors.length > 0) {
			throw new AggregateError(errors, 'Failed to close the game manager cleanly.');
		}
	}

	public addGameFactory(factory: GameFactory): void {
		this._gameFactories[factory.title] = factory;
	}

	public removeGameFactory(title: string): void {
		delete this._gameFactories[title];
	}

	public async restoreGames(): Promise<void> {
		const gameData = await this._gameStore.loadGameData();
		const existingGames = Object.values(this._games);
		const restoredCodes = new Set(existingGames.map(({ code }) => code));
		const restoredIds = new Set(existingGames.map(({ id }) => id));
		let restoredGameCount = existingGames.length;

		for (const title in gameData) {
			if (!this._gameFactories[title]) {
				throw new Error(`No factory for game "${title}"`);
			}

			for (const gameFileData of gameData[title]) {
				if (restoredGameCount >= MAX_ACTIVE_GAMES) {
					throw new Error(`Cannot restore more than ${MAX_ACTIVE_GAMES} active games.`);
				}
				const game = this._gameFactories[title].hydrate(
					gameFileData,
					this._socketManager,
					this._gameStore,
				);
				if (restoredIds.has(game.id) || restoredCodes.has(game.code)) {
					game.cleanUp();
					const duplicateField = restoredIds.has(game.id)
						? `id "${game.id}"`
						: `code "${game.code}"`;
					throw new Error(`Cannot restore duplicate game ${duplicateField}.`);
				}
				restoredIds.add(game.id);
				restoredCodes.add(game.code);
				this._games[game.id] = game;
				restoredGameCount += 1;

				console.log(`Restoring ${title} game ${game.id}.`);
			}
		}
	}

	private _createGame(title: string, watch: boolean, userId: string, socketId: string) {
		// Make sure the title is valid.
		if (!this._gameFactories[title]) {
			this._socketManager.sendToSocket(socketId, {
				scope: GAME_MANAGER_SCOPE,
				type: 'CreateGameResponseMessage',
				data: { error: `No game with title "${title}".` },
			});
			return;
		}
		if (Object.keys(this._games).length >= MAX_ACTIVE_GAMES) {
			this._socketManager.sendToSocket(socketId, {
				scope: GAME_MANAGER_SCOPE,
				type: 'CreateGameResponseMessage',
				data: { error: 'The server has reached its active game limit.' },
			});
			return;
		}
		const gamesForCreator = Object.values(this._games).filter(
			(game) => game.creatorId === userId,
		).length;
		if (gamesForCreator >= MAX_ACTIVE_GAMES_PER_CREATOR) {
			this._socketManager.sendToSocket(socketId, {
				scope: GAME_MANAGER_SCOPE,
				type: 'CreateGameResponseMessage',
				data: { error: `You can have at most ${MAX_ACTIVE_GAMES_PER_CREATOR} active games.` },
			});
			return;
		}

		// Make the game, retrying the vanishingly rare case of a code collision.
		let game: Game | undefined;
		for (let attempt = 0; attempt < GAME_CREATION_CODE_ATTEMPTS; attempt += 1) {
			const candidate = this._gameFactories[title].create(
				userId,
				this._socketManager,
				this._gameStore,
			);
			if (
				!Object.values(this._games).some((existingGame) => existingGame.code === candidate.code)
			) {
				game = candidate;
				break;
			}
			candidate.cleanUp();
		}
		if (!game) {
			this._socketManager.sendToSocket(socketId, {
				scope: GAME_MANAGER_SCOPE,
				type: 'CreateGameResponseMessage',
				data: { error: 'Could not allocate a unique game code.' },
			});
			return;
		}
		this._games[game.id] = game;

		// Add the watcher.
		if (watch) {
			game.watchers.push(userId);
		}

		// Send game data back.
		this._socketManager.sendToSocket(socketId, {
			scope: GAME_MANAGER_SCOPE,
			type: 'CreateGameResponseMessage',
			data: { game: { id: game.id, code: game.code } },
		});
	}

	private _watchGame(code: string, userId: string, socketId: string, abuseKey: string) {
		const now = Date.now();
		const userRateLimit = this._getWatchRateLimit(this._watchRateLimits, userId, now);
		const abuseRateLimit = this._getWatchRateLimit(this._watchAbuseRateLimits, abuseKey, now);
		if (
			userRateLimit.failedAttempts >= MAX_FAILED_WATCH_ATTEMPTS ||
			abuseRateLimit.failedAttempts >= MAX_FAILED_WATCH_ATTEMPTS
		) {
			this._socketManager.sendToSocket(socketId, {
				scope: GAME_MANAGER_SCOPE,
				type: 'WatchGameResponseMessage',
				data: { error: 'Too many failed game-code attempts. Try again in a minute.' },
			});
			return;
		}
		// Find the game from the code.
		const game = Object.values(this._games).find((g) => g.code === code);

		if (!game) {
			userRateLimit.failedAttempts += 1;
			abuseRateLimit.failedAttempts += 1;
			this._socketManager.sendToSocket(socketId, {
				scope: GAME_MANAGER_SCOPE,
				type: 'WatchGameResponseMessage',
				data: { error: `No game with code "${code}".` },
			});
			return;
		}
		// Add the watcher. Prevent duplicates.
		if (!game.watchers.includes(userId)) {
			game.watchers.push(userId);
		}

		// Send game id/code as a success message.
		this._socketManager.sendToSocket(socketId, {
			scope: GAME_MANAGER_SCOPE,
			type: 'WatchGameResponseMessage',
			data: { game: { id: game.id, code: game.code } },
		});
	}

	private _getWatchRateLimit(
		limits: Map<string, WatchRateLimit>,
		key: string,
		now: number,
	): WatchRateLimit {
		let rateLimit = limits.get(key);
		if (!rateLimit || now - rateLimit.windowStartedAt >= FAILED_WATCH_WINDOW_MS) {
			rateLimit = { failedAttempts: 0, windowStartedAt: now };
			limits.set(key, rateLimit);
		}
		return rateLimit;
	}

	private _boundWatchRateLimits(limits: Map<string, WatchRateLimit>): void {
		if (limits.size <= MAX_WATCH_RATE_LIMIT_ENTRIES) return;
		const oldestKey = limits.keys().next().value;
		if (typeof oldestKey === 'string') limits.delete(oldestKey);
	}

	public _removeGame(id: string): void {
		const game = this._games[id];
		if (!game) {
			return;
		}

		delete this._games[id];
		game.stopSaving();

		const removal = this._flushAndDeleteGame(game)
			.catch((error) => {
				this._removalErrors.push(error);
				Logger.error(`Failed to remove ${game.title} game ${game.id}.`, error);
			})
			.finally(() => {
				this._pendingRemovals.delete(removal);
			});
		this._pendingRemovals.add(removal);
	}

	private async _flushAndDeleteGame(game: Game): Promise<void> {
		const errors: unknown[] = [];

		try {
			await game.flushSaves();
		} catch (error) {
			errors.push(error);
		}

		try {
			game.cleanUp();
		} catch (error) {
			errors.push(error);
		}

		try {
			await this._gameStore.deleteGame(game);
		} catch (error) {
			errors.push(error);
		}

		if (errors.length > 0) {
			throw new AggregateError(errors, `Failed to remove ${game.title} game ${game.id}.`);
		}
	}

	public prune(olderThan = 24 * 60 * 60 * 1000): Game[] {
		const oldestGameTime = new Date(new Date().getTime() - olderThan);

		// Iterate over all games and collect pruned entries.
		const prunedEntries = [];
		for (const game of Object.values(this._games)) {
			if (game.updated < oldestGameTime) {
				prunedEntries.push(game);
				this._removeGame(game.id);
			}
		}

		// Send back a list of all we've pruned.
		return prunedEntries;
	}

	private _handleMessage = ({
		abuseKey,
		socketId,
		userId,
		message,
	}: {
		abuseKey: string;
		socketId: string;
		userId: string;
		message: GameManagerMessage;
	}) => {
		switch (message.type) {
			case 'CreateGameMessage': {
				const data: unknown = message.data;
				if (
					typeof data !== 'object' ||
					data === null ||
					typeof (data as Record<string, unknown>).title !== 'string' ||
					(data as { title: string }).title.length > 50 ||
					((data as Record<string, unknown>).watch !== undefined &&
						typeof (data as Record<string, unknown>).watch !== 'boolean')
				) {
					this._socketManager.sendToSocket(socketId, {
						scope: GAME_MANAGER_SCOPE,
						type: 'CreateGameResponseMessage',
						data: { error: 'Invalid create-game request.' },
					});
					return;
				}
				this._createGame(
					(data as { title: string }).title,
					(data as { watch?: boolean }).watch === true,
					userId,
					socketId,
				);
				break;
			}
			case 'WatchGameMessage': {
				const data: unknown = message.data;
				const code =
					typeof data === 'object' &&
					data !== null &&
					typeof (data as Record<string, unknown>).code === 'string'
						? (data as { code: string }).code.trim().toLowerCase()
						: '';
				if (!/^[23456789abdegjkmnpqrvwxyz]{4,12}$/.test(code)) {
					this._socketManager.sendToSocket(socketId, {
						scope: GAME_MANAGER_SCOPE,
						type: 'WatchGameResponseMessage',
						data: { error: 'Invalid game code.' },
					});
					return;
				}
				this._watchGame(code, userId, socketId, abuseKey);
				break;
			}
		}

		this._boundWatchRateLimits(this._watchRateLimits);
		this._boundWatchRateLimits(this._watchAbuseRateLimits);
	};
}
