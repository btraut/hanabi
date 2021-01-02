import { GAME_MANAGER_SCOPE, GameManagerMessage } from 'app/src/games/GameManagerMessages';
import Game from 'app/src/games/server/Game';
import SocketManager from 'app/src/utils/server/SocketManager';

type GameFactory = (creatorId: string, socketManager: SocketManager<any>) => Game;

export default class GameManager {
	private _gameFactories: { [title: string]: GameFactory } = {};
	private _games: { [id: string]: Game } = {};

	private _socketManager: SocketManager<GameManagerMessage>;
	private _socketManagerOnMessageSubscriptionId: number | null = null;

	constructor(socketManager: SocketManager<GameManagerMessage>) {
		this._socketManager = socketManager;
		this._socketManagerOnMessageSubscriptionId = socketManager.addScopedMessageHandler(
			this._handleMessage,
			GAME_MANAGER_SCOPE,
		);
	}

	public cleanUp(): void {
		if (this._socketManagerOnMessageSubscriptionId !== null) {
			this._socketManager.onMessage.unsubscribe(this._socketManagerOnMessageSubscriptionId);
		}
	}

	public addGameFactory(title: string, factory: GameFactory): void {
		this._gameFactories[title] = factory;
	}

	public removeGameFactory(title: string): void {
		delete this._gameFactories[title];
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
		const game = this._gameFactories[title](userId, this._socketManager);
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
