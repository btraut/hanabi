import {
	CreateGameMessage,
	CreateGameResponseMessage,
	GAME_MANAGER_SCOPE,
	WatchGameMessage,
	WatchGameResponseMessage,
} from 'app/src/games/GameManagerMessages';
import ClientSocketManager from 'app/src/utils/client/SocketManager';

export default class GameManager {
	protected _socketManager: ClientSocketManager;

	constructor(socketManager: ClientSocketManager) {
		this._socketManager = socketManager;
	}

	public async create(title: string): Promise<{ id: string; code: string }> {
		// Attempt to create a game.
		const hostGameMessage: CreateGameMessage = {
			scope: GAME_MANAGER_SCOPE,
			type: 'CreateGameMessage',
			data: { title, watch: true },
		};
		this._socketManager.send(hostGameMessage);

		const response = await this._socketManager.expectMessageOfType<CreateGameResponseMessage>(
			'CreateGameResponseMessage',
		);

		if (response.data.error) {
			throw new Error(`Error creating new game: ${response.data.error}`);
		}

		// Game created!
		return response.data.game!;
	}

	public async watch(code: string): Promise<{ id: string; code: string }> {
		// Attempt to watch the game using the game code.
		const watchGameMessage: WatchGameMessage = {
			scope: GAME_MANAGER_SCOPE,
			type: 'WatchGameMessage',
			data: { code },
		};
		this._socketManager.send(watchGameMessage);

		const response = await this._socketManager.expectMessageOfType<WatchGameResponseMessage>(
			'WatchGameResponseMessage',
		);

		if (response.data.error) {
			throw new Error(response.data.error);
		}

		// Game watched!
		return response.data.game!;
	}
}
