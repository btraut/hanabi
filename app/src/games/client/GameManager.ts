import {
	GAME_MANAGER_SOCKET_MESSAGE_SCOPE,
	HostGameMessage,
	HostGameResponseMessage,
} from 'app/src/games/GameManagerMessages';
import ClientSocketManager from 'app/src/utils/client/SocketManager';

export default class GameManager {
	private _socketManager: ClientSocketManager;

	constructor(socketManager: ClientSocketManager) {
		this._socketManager = socketManager;
	}

	protected async _createGame(title: string): Promise<string> {
		const hostGameMessage: HostGameMessage = {
			scope: GAME_MANAGER_SOCKET_MESSAGE_SCOPE,
			type: 'HostGameMessage',
			data: { title },
		};
		this._socketManager.send(hostGameMessage);

		const response = await this._socketManager.expectMessageOfType<HostGameResponseMessage>(
			'HostGameResponseMessage',
		);

		if (response.data.error) {
			throw new Error(`Error creating new game: ${response.data.error}`);
		}

		return response.data.id!;
	}
}
