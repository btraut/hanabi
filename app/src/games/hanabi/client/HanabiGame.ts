import Game from 'app/src/games/client/Game';
import {
	generateHanabiGameData,
	HANABI_GAME_TITLE,
	HanabiGameData,
} from 'app/src/games/hanabi/HanabiGameData';
import {
	AddPlayerResponseMessage,
	getScope,
	HanabiMessage,
	RefreshGameDataMessage,
	RemovePlayerResponseMessage,
	StartGameResponseMessage,
} from 'app/src/games/hanabi/HanabiMessages';
import AuthSocketManager, { AuthenticationState } from 'app/src/utils/client/AuthSocketManager';
import SocketManager, { ConnectionState } from 'app/src/utils/client/SocketManager';
import PubSub from 'app/src/utils/PubSub';

export default class HanabiGame extends Game {
	public onUpdate = new PubSub<void>();

	private _gameData: HanabiGameData = generateHanabiGameData();
	public get gameData(): Readonly<HanabiGameData> {
		return this._gameData;
	}

	private _connected = false;

	private _socketManager: SocketManager<HanabiMessage>;
	private _socketManagerOnMessageSubscriptionId: number;
	private _socketManagerOnConnectSubscriptionId: number;
	private _socketManagerOnDisconnectSubscriptionId: number;

	private _authSocketManager: AuthSocketManager;
	private _socketManagerOnAuthenticateSubscriptionId: number;

	constructor(
		id: string,
		code: string,
		socketManager: SocketManager<HanabiMessage>,
		authSocketManager: AuthSocketManager,
	) {
		super(id, code);

		this._socketManager = socketManager;
		this._socketManagerOnConnectSubscriptionId = socketManager.onConnect.subscribe(
			this._updateConnectionStatus,
		);
		this._socketManagerOnDisconnectSubscriptionId = socketManager.onDisconnect.subscribe(
			this._updateConnectionStatus,
		);
		this._socketManagerOnMessageSubscriptionId = socketManager.onMessage.subscribe(
			this._handleMessage,
		);

		this._authSocketManager = authSocketManager;
		this._socketManagerOnAuthenticateSubscriptionId = authSocketManager.onAuthenticate.subscribe(
			this._updateConnectionStatus,
		);

		this._connected =
			this._socketManager.connectionState === ConnectionState.Connected &&
			this._authSocketManager.authenticationState === AuthenticationState.Authenticated;
	}

	public cleanUp(): void {
		this._socketManager.onConnect.unsubscribe(this._socketManagerOnConnectSubscriptionId);
		this._socketManager.onDisconnect.unsubscribe(this._socketManagerOnDisconnectSubscriptionId);
		this._socketManager.onMessage.unsubscribe(this._socketManagerOnMessageSubscriptionId);
		this._authSocketManager.onAuthenticate.unsubscribe(
			this._socketManagerOnAuthenticateSubscriptionId,
		);
	}

	private _updateConnectionStatus = () => {
		this._connected =
			this._socketManager.connectionState === ConnectionState.Connected &&
			this._authSocketManager.authenticationState === AuthenticationState.Authenticated;

		if (this._connected) {
			this.refreshGameData();
		}
	};

	private _handleMessage = (message: HanabiMessage) => {
		if (message.scope !== getScope(HANABI_GAME_TITLE, this._id)) {
			return;
		}

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
			scope: getScope(HANABI_GAME_TITLE, this._id),
			type: 'GetGameDataMessage',
			data: undefined,
		});

		await this._expectRefreshGameData();

		this.onUpdate.emit();
	}

	public async join(name: string): Promise<void> {
		this._socketManager.send({
			scope: getScope(HANABI_GAME_TITLE, this._id),
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
			scope: getScope(HANABI_GAME_TITLE, this._id),
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
			scope: getScope(HANABI_GAME_TITLE, this._id),
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
}
