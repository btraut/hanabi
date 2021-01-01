import Game from 'app/src/games/Game';
import {
	CreateGameResponseMessage,
	GAME_MANAGER_SCOPE,
	GameManagerMessage,
	WatchGameResponseMessage,
} from 'app/src/games/GameManagerMessages';
import SocketManager from 'app/src/utils/server/SocketManager';

type GameFactory = (creatorId: string, socketManager: SocketManager) => Game;

export default class GameManager {
	private _gameFactories: { [title: string]: GameFactory } = {};
	private _games: { [id: string]: Game } = {};
	private _socketManager: SocketManager;

	constructor(socketManager: SocketManager) {
		this._socketManager = socketManager;
		socketManager.addScopedMessageHandler<GameManagerMessage>(
			this._handleMessage,
			GAME_MANAGER_SCOPE,
		);
	}

	public addGameFactory(title: string, factory: GameFactory): void {
		this._gameFactories[title] = factory;
	}

	public removeGameFactory(title: string): void {
		delete this._gameFactories[title];
	}

	private _createGame(title: string, userId: string) {
		if (!this._gameFactories[title]) {
			const errorMessage: CreateGameResponseMessage = {
				scope: GAME_MANAGER_SCOPE,
				type: 'CreateGameResponseMessage',
				data: { error: `No game with title "${title}".` },
			};
			this._socketManager.send(userId, errorMessage);
			return;
		}

		const game = this._gameFactories[title](userId, this._socketManager);

		this._games[game.id] = game;

		const successMessage: CreateGameResponseMessage = {
			scope: GAME_MANAGER_SCOPE,
			type: 'CreateGameResponseMessage',
			data: { game: { id: game.id, code: game.code } },
		};
		this._socketManager.send(userId, successMessage);
	}

	private _watchGame(code: string, userId: string) {
		// Find the game from the code.
		const game = Object.values(this._games).find((g) => g.code === code);

		if (!game) {
			const errorMessage: WatchGameResponseMessage = {
				scope: GAME_MANAGER_SCOPE,
				type: 'WatchGameResponseMessage',
				data: { error: `No game with code "${code}".` },
			};
			this._socketManager.send(userId, errorMessage);
			return;
		}

		// Add the watcher. Prevent duplicates.
		if (!game.watchers.includes(userId)) {
			game.watchers.push(userId);
		}

		// Send game id/code as a success message.
		const successMessage: WatchGameResponseMessage = {
			scope: GAME_MANAGER_SCOPE,
			type: 'WatchGameResponseMessage',
			data: { game: { id: game.id, code: game.code } },
		};
		this._socketManager.send(userId, successMessage);
	}

	public _removeGame(id: string): void {
		this._games[id].cleanUp();
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
				this._createGame(message.data.title, userId);
				break;
			case 'WatchGameMessage':
				this._watchGame(message.data.code, userId);
				break;
		}
	};
}
