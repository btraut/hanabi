import {
	CreateGameMessage,
	CreateGameResponseMessage,
	GAME_MANAGER_SCOPE,
	WatchGameMessage,
	WatchGameResponseMessage,
} from 'app/src/games/GameManagerMessages';
import ClientSocketManager from 'app/src/utils/client/SocketManager';
import PubSub from 'app/src/utils/PubSub';

export default class GameManager {
	public onUpdate = new PubSub<void>();

	protected _userId: string | null = null;
	public get userId(): string | null {
		return this._userId;
	}

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
		// Attempt to create a game.
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

		// Game created! Save the id/code.
		this._gameId = response.data.game!.id;
		this._code = response.data.game!.code;

		this.onUpdate.emit();
	}

	public async watch(code: string): Promise<void> {
		// Attempt to watch the game using the game code.
		const watchGameMessage: WatchGameMessage = {
			scope: GAME_MANAGER_SCOPE,
			type: 'WatchGameMessage',
			data: { code },
		};
		this._socketManager.send(watchGameMessage);

		const watchGameResponseMessage = await this._socketManager.expectMessageOfType<WatchGameResponseMessage>(
			'WatchGameResponseMessage',
		);

		if (watchGameResponseMessage.data.error) {
			throw new Error(watchGameResponseMessage.data.error);
		}

		// We've successfully watched! Save the id/code.
		this._gameId = watchGameResponseMessage.data.game!.id;
		this._code = watchGameResponseMessage.data.game!.code;

		this.onUpdate.emit();
	}
}
