import {
	CreateGameMessage,
	CreateGameResponseMessage,
	GAME_MANAGER_SCOPE,
} from 'app/src/games/GameManagerMessages';
import ClientSocketManager from 'app/src/utils/client/SocketManager';
import PubSub from 'app/src/utils/PubSub';

export default class GameManager {
	public onUpdate = new PubSub<void>();

	protected _gameId: string | null = null;
	public get gameId(): string | null {
		return this._gameId;
	}

	protected _code: string | null = null;
	public get code(): string | null {
		return this._code;
	}

	protected _socketManager: ClientSocketManager;

	constructor(socketManager: ClientSocketManager) {
		this._socketManager = socketManager;
	}

	// Children must override.
	protected get _title(): string {
		throw new Error();
	}

	public async create(): Promise<void> {
		const hostGameMessage: CreateGameMessage = {
			scope: GAME_MANAGER_SCOPE,
			type: 'CreateGameMessage',
			data: { title: this._title },
		};
		this._socketManager.send(hostGameMessage);

		const response = await this._socketManager.expectMessageOfType<CreateGameResponseMessage>(
			'CreateGameResponseMessage',
		);

		if (response.data.error) {
			throw new Error(`Error creating new game: ${response.data.error}`);
		}

		this._gameId = response.data.game!.id;
		this._code = response.data.game!.code;

		this.onUpdate.emit();
	}
}
