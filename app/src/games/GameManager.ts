import {
	GameManagerMessage,
	HostGameErrorInvalidTitleMessage,
} from 'app/src/games/GameManagerMessages';
import ServerSocketManager from 'app/src/utils/ServerSocketManager';

import Game from './Game';

const GAME_MANAGER_SOCKET_MESSAGE_SCOPE = '__GAME_MANAGER_SOCKET_MESSAGE_SCOPE__';

type GameFactory = (creatorId: string, socketManager: ServerSocketManager) => Game;

export default class GameManager {
	private _gameFactories: { [title: string]: GameFactory };
	private _games: { [id: string]: Game } = {};
	private _socketManager: ServerSocketManager;

	constructor(socketManager: ServerSocketManager) {
		this._socketManager = socketManager;
		socketManager.addScopedMessageHandler<GameManagerMessage>(
			this._handleMessage,
			GAME_MANAGER_SOCKET_MESSAGE_SCOPE,
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
			const errorMessage: HostGameErrorInvalidTitleMessage = {
				scope: GAME_MANAGER_SOCKET_MESSAGE_SCOPE,
				type: 'hostGameErrorInvalidTypeMessage',
				data: { title },
			};
			this._socketManager.send(userId, errorMessage);
			return;
		}

		const game = this._gameFactories[title](userId, this._socketManager);

		this._games[game.id] = game;
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

	private _handleMessage({ userId, message }: { userId: string; message: GameManagerMessage }) {
		switch (message.type) {
			case 'hostGame':
				this._createGame(message.data.title, userId);
				break;
		}
	}
}
