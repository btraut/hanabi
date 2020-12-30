import Game from 'app/src/games/Game';
import {
	GAME_MANAGER_SOCKET_MESSAGE_SCOPE,
	GameManagerMessage,
	HostGameResponseMessage,
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
			const errorMessage: HostGameResponseMessage = {
				scope: GAME_MANAGER_SOCKET_MESSAGE_SCOPE,
				type: 'HostGameResponseMessage',
				data: { error: `No game with title "${title}".` },
			};
			this._socketManager.send(userId, errorMessage);
			return;
		}

		const game = this._gameFactories[title](userId, this._socketManager);

		this._games[game.id] = game;

		const successMessage: HostGameResponseMessage = {
			scope: GAME_MANAGER_SOCKET_MESSAGE_SCOPE,
			type: 'HostGameResponseMessage',
			data: { id: game.id },
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
			case 'HostGameMessage':
				this._createGame(message.data.title, userId);
				break;
		}
	};
}
