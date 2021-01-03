import Game from 'app/src/games/client/Game';
import {
	AddPlayerResponseMessage,
	EscapeGameMessage,
	getScope,
	MovePlayerResponseMessage,
	RefreshGameDataMessage,
	RemovePlayerResponseMessage,
	StartGameResponseMessage,
} from 'app/src/games/escape/EscapeGameMessages';
import { ESCAPE_GAME_TITLE } from 'app/src/games/escape/EscapeGameRules';
import { Direction } from 'app/src/games/escape/Movement';
import {
	emptyEscapeGameData,
	SerialEscapeGameData,
} from 'app/src/games/escape/server/EscapeGameData';
import SocketManager from 'app/src/utils/client/SocketManager';
import PubSub from 'app/src/utils/PubSub';

export default class EscapeGame extends Game {
	public onUpdate = new PubSub<void>();

	private _gameData: SerialEscapeGameData = emptyEscapeGameData;
	public get gameData(): SerialEscapeGameData {
		return this._gameData;
	}

	private _socketManager: SocketManager<EscapeGameMessage>;
	private _socketManagerOnMessageSubscriptionId: number | null = null;

	constructor(id: string, code: string, socketManager: SocketManager<EscapeGameMessage>) {
		super(id, code);

		this._socketManager = socketManager;
		this._socketManagerOnMessageSubscriptionId = socketManager.addScopedMessageHandler(
			this._handleMessage,
			getScope(ESCAPE_GAME_TITLE, this._id),
		);
	}

	public cleanUp(): void {
		if (this._socketManagerOnMessageSubscriptionId !== null) {
			this._socketManager.onMessage.unsubscribe(this._socketManagerOnMessageSubscriptionId);
			this._socketManagerOnMessageSubscriptionId = null;
		}
	}

	private _handleMessage = (message: EscapeGameMessage) => {
		switch (message.type) {
			case 'RefreshGameDataMessage':
				this._handleRefreshGameDataMessage(message);
				break;
		}
	};

	private _handleRefreshGameDataMessage({ data }: RefreshGameDataMessage) {
		this._gameData = data;

		this.onUpdate.emit();
	}

	private async _expectRefreshGameData(): Promise<void> {
		const getStateResponseMessage = await this._socketManager.expectMessageOfType<RefreshGameDataMessage>(
			'RefreshGameDataMessage',
		);

		this._gameData = getStateResponseMessage.data;
	}

	public async refreshGameData(): Promise<void> {
		this._socketManager.send({
			scope: getScope(ESCAPE_GAME_TITLE, this._id),
			type: 'GetGameDataMessage',
			data: undefined,
		});

		await this._expectRefreshGameData();

		this.onUpdate.emit();
	}

	public async join(name: string): Promise<void> {
		this._socketManager.send({
			scope: getScope(ESCAPE_GAME_TITLE, this._id),
			type: 'AddPlayerMessage',
			data: { name },
		});

		const addPlayerResponseMessage = await this._socketManager.expectMessageOfType<AddPlayerResponseMessage>(
			'AddPlayerResponseMessage',
		);

		if (addPlayerResponseMessage.data.error) {
			throw new Error(addPlayerResponseMessage.data.error);
		}

		// After responding to our initial message, the server will also send a
		// RefreshGameData message. We'll handle that in a separate handler.
	}

	public async leave(): Promise<void> {
		this._socketManager.send({
			scope: getScope(ESCAPE_GAME_TITLE, this._id),
			type: 'RemovePlayerMessage',
			data: {},
		});

		const removePlayerResponseMessage = await this._socketManager.expectMessageOfType<RemovePlayerResponseMessage>(
			'RemovePlayerResponseMessage',
		);

		if (removePlayerResponseMessage.data.error) {
			throw new Error(removePlayerResponseMessage.data.error);
		}

		// After responding to our initial message, the server will also send a
		// RefreshGameData message. We'll handle that in a separate handler.
	}

	public async start(): Promise<void> {
		this._socketManager.send({
			scope: getScope(ESCAPE_GAME_TITLE, this._id),
			type: 'StartGameMessage',
			data: undefined,
		});

		const startGameResponseMessage = await this._socketManager.expectMessageOfType<StartGameResponseMessage>(
			'StartGameResponseMessage',
		);

		if (startGameResponseMessage.data.error) {
			throw new Error(startGameResponseMessage.data.error);
		}

		// After responding to our initial message, the server will also send a
		// RefreshGameData message. We'll handle that in a separate handler.
	}

	public async move(direction: Direction): Promise<void> {
		this._socketManager.send({
			scope: getScope(ESCAPE_GAME_TITLE, this._id),
			type: 'MovePlayerMessage',
			data: { direction },
		});

		const movePlayerResponseMessage = await this._socketManager.expectMessageOfType<MovePlayerResponseMessage>(
			'MovePlayerResponseMessage',
		);

		if (movePlayerResponseMessage.data.error) {
			throw new Error(movePlayerResponseMessage.data.error);
		}

		// After responding to our initial message, the server will also send a
		// RefreshGameData message. We'll handle that in a separate handler.
	}
}
