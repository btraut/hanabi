import {
	CreateGameResponseMessage,
	GAME_MANAGER_SCOPE,
	GameManagerMessage,
	WatchGameResponseMessage,
} from '@hanabi/shared';
import SocketManager from '~/utils/client/SocketManager';

export default class GameManager {
	protected _socketManager: SocketManager<GameManagerMessage>;

	constructor(socketManager: SocketManager<GameManagerMessage>) {
		this._socketManager = socketManager;
	}

	public async create(title: string): Promise<{ id: string; code: string }> {
		// Attempt to create a game.
		this._socketManager.send({
			scope: GAME_MANAGER_SCOPE,
			type: 'CreateGameMessage',
			data: { title, watch: true },
		});

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
		this._socketManager.send({
			scope: GAME_MANAGER_SCOPE,
			type: 'WatchGameMessage',
			data: { code },
		});

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
