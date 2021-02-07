import { GAME_MANAGER_SCOPE, GameManagerMessage } from 'app/src/games/GameManagerMessages';
import Game from 'app/src/games/server/Game';
import GameFactory from 'app/src/games/server/GameFactory';
import SocketManager from 'app/src/utils/server/SocketManager';
import { existsSync, promises } from 'fs';

export default class GameManager {
	private _gameFactories: { [title: string]: GameFactory } = {};
	private _games: { [id: string]: Game } = {};

	private _savedGamesPath: string;

	private _socketManager: SocketManager<GameManagerMessage>;
	private _socketManagerOnMessageSubscriptionId: number | null = null;

	constructor(socketManager: SocketManager<GameManagerMessage>, savedGamesPath: string) {
		this._socketManager = socketManager;
		this._socketManagerOnMessageSubscriptionId = socketManager.addScopedMessageHandler(
			this._handleMessage,
			GAME_MANAGER_SCOPE,
		);
		this._savedGamesPath = savedGamesPath;
	}

	public cleanUp(): void {
		if (this._socketManagerOnMessageSubscriptionId !== null) {
			this._socketManager.onMessage.unsubscribe(this._socketManagerOnMessageSubscriptionId);
		}
	}

	public addGameFactory(factory: GameFactory): void {
		this._gameFactories[factory.title] = factory;
	}

	public removeGameFactory(title: string): void {
		delete this._gameFactories[title];
	}

	public async restoreGames(): Promise<void> {
		const gameData = await this._readSavedGameData();

		for (const gameName in gameData) {
			if (!this._gameFactories[gameName]) {
				throw new Error(`No factory for game "${gameName}"`);
			}

			for (const gameFileData of gameData[gameName]) {
				const game = this._gameFactories[gameName].hydrate(gameFileData, this._socketManager);
				game.saveGameDelegate = this;
				this._games[game.id] = game;

				console.log(`Restoring ${gameName} game ${game.id}.`);
			}
		}
	}

	private async _readSavedGameData(): Promise<{ [gameName: string]: string[] }> {
		const { lstat, readdir, readFile } = promises;

		const gameData: { [gameName: string]: string[] } = {};

		if (!existsSync(this._savedGamesPath)) {
			return gameData;
		}

		const gameDirs = await readdir(this._savedGamesPath);

		for (const gameName of gameDirs) {
			const stat = await lstat(`${this._savedGamesPath}/${gameName}`);

			if (!stat.isDirectory()) {
				continue;
			}

			gameData[gameName] = [];

			const gameFiles = await readdir(`${this._savedGamesPath}/${gameName}`);

			for (const gameFile of gameFiles) {
				const gameFileData = await readFile(
					`${this._savedGamesPath}/${gameName}/${gameFile}`,
					'utf8',
				);
				gameData[gameName].push(gameFileData);
			}
		}

		return gameData;
	}

	public async saveGames(): Promise<void> {
		await Promise.all(Object.values(this._games).map(this.saveGame));
	}

	public async saveGame(game: Game): Promise<void> {
		const { writeFile, mkdir } = promises;

		const serialized = game.serialize();
		const path = `${this._savedGamesPath}/${game.title}/${game.id}`;

		if (!existsSync(this._savedGamesPath)) {
			await mkdir(this._savedGamesPath);
		}

		if (!existsSync(`${this._savedGamesPath}/${game.title}`)) {
			await mkdir(`${this._savedGamesPath}/${game.title}`);
		}

		if (serialized !== null) {
			await writeFile(path, serialized);
		}
	}

	public async deleteGame(game: Game): Promise<void> {
		const { rm } = promises;

		const path = `${this._savedGamesPath}/${game.title}/${game.id}`;

		if (existsSync(path)) {
			await rm(path);
		}
	}

	private _createGame(title: string, watch: boolean, userId: string) {
		// Make sure the title is valid.
		if (!this._gameFactories[title]) {
			this._socketManager.send(userId, {
				scope: GAME_MANAGER_SCOPE,
				type: 'CreateGameResponseMessage',
				data: { error: `No game with title "${title}".` },
			});
			return;
		}

		// Make the game.
		const game = this._gameFactories[title].create(userId, this._socketManager);
		game.saveGameDelegate = this;
		this._games[game.id] = game;

		// Add the watcher.
		if (!watch) {
			game.watchers.push(userId);
		}

		// Send game data back.
		this._socketManager.send(userId, {
			scope: GAME_MANAGER_SCOPE,
			type: 'CreateGameResponseMessage',
			data: { game: { id: game.id, code: game.code } },
		});
	}

	private _watchGame(code: string, userId: string) {
		// Find the game from the code.
		const game = Object.values(this._games).find((g) => g.code === code);

		if (!game) {
			this._socketManager.send(userId, {
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
		this._socketManager.send(userId, {
			scope: GAME_MANAGER_SCOPE,
			type: 'WatchGameResponseMessage',
			data: { game: { id: game.id, code: game.code } },
		});
	}

	public _removeGame(id: string): void {
		this._games[id].cleanUp();
		this.deleteGame(this._games[id]);
		delete this._games[id];
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
		userId,
		message,
	}: {
		userId: string;
		message: GameManagerMessage;
	}) => {
		switch (message.type) {
			case 'CreateGameMessage':
				this._createGame(message.data.title, !!message.data.watch, userId);
				break;
			case 'WatchGameMessage':
				this._watchGame(message.data.code, userId);
				break;
		}
	};
}
