import Game from 'app/src/games/client/Game';
import {
	generateHanabiGameData,
	HANABI_GAME_TITLE,
	HanabiGameData,
	HanabiTile,
	HanabiTileColor,
	HanabiTileNumber,
	Position,
} from 'app/src/games/hanabi/HanabiGameData';
import {
	AddPlayerResponseMessage,
	DiscardTileResponseMessage,
	getScope,
	GiveClueResponseMessage,
	HanabiMessage,
	MoveTileResponseMessage,
	PlayTileResponseMessage,
	RefreshGameDataMessage,
	RemovePlayerResponseMessage,
	StartGameResponseMessage,
} from 'app/src/games/hanabi/HanabiMessages';
import AuthSocketManager, { AuthenticationState } from 'app/src/utils/client/AuthSocketManager';
import SocketManager, { ConnectionState } from 'app/src/utils/client/SocketManager';
import DistributiveOmit from 'app/src/utils/DistributiveOmit';
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

	private _sendMessage(message: DistributiveOmit<HanabiMessage, 'scope'>) {
		this._socketManager.send({
			...message,
			scope: getScope(HANABI_GAME_TITLE, this._id),
		});
	}

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
		this._sendMessage({
			type: 'GetGameDataMessage',
			data: undefined,
		});

		await this._expectRefreshGameData();

		this.onUpdate.emit();
	}

	public async join(name: string): Promise<void> {
		this._sendMessage({
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
		this._sendMessage({
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
		this._sendMessage({
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

	public async moveTile(userId: string, tileId: string, newPosition: Position): Promise<void> {
		const tileLocation = this._gameData.players[userId].tileLocations.find(
			(tl) => tl.tile.id === tileId,
		);

		if (!tileLocation) {
			throw new Error('Invalid player or tile id.');
		}

		tileLocation.position = { ...newPosition };

		// Emit an early onUpdate. We'll update again after we get a response
		// from the server, but we want to optimistically move the tile now.
		this.onUpdate.emit();

		this._sendMessage({
			type: 'MoveTileMessage',
			data: { id: tileId, position: newPosition },
		});

		const moveTileResponseMessage = await this._socketManager.expectMessageOfType<MoveTileResponseMessage>(
			'MoveTileResponseMessage',
		);

		if (moveTileResponseMessage.data.error) {
			throw new Error(moveTileResponseMessage.data.error);
		}

		// After responding to our initial message, the server will also send a
		// RefreshGameData message. We'll handle that in a separate handler.
	}

	public async discardTile(tile: HanabiTile): Promise<void> {
		this._sendMessage({
			type: 'DiscardTileMessage',
			data: { id: tile.id },
		});

		const discardTileResponseMessage = await this._socketManager.expectMessageOfType<DiscardTileResponseMessage>(
			'DiscardTileResponseMessage',
		);

		if (discardTileResponseMessage.data.error) {
			throw new Error(discardTileResponseMessage.data.error);
		}

		// After responding to our initial message, the server will also send a
		// RefreshGameData message. We'll handle that in a separate handler.
	}

	public async playTile(tile: HanabiTile): Promise<void> {
		this._sendMessage({
			type: 'PlayTileMessage',
			data: { id: tile.id },
		});

		const playTileResponseMessage = await this._socketManager.expectMessageOfType<PlayTileResponseMessage>(
			'PlayTileResponseMessage',
		);

		if (playTileResponseMessage.data.error) {
			throw new Error(playTileResponseMessage.data.error);
		}

		// After responding to our initial message, the server will also send a
		// RefreshGameData message. We'll handle that in a separate handler.
	}

	public async giveColorClue(to: string, color: HanabiTileColor): Promise<void> {
		this._sendMessage({
			type: 'GiveClueMessage',
			data: { to, color },
		});

		const giveClueResponseMessage = await this._socketManager.expectMessageOfType<GiveClueResponseMessage>(
			'GiveClueResponseMessage',
		);

		if (giveClueResponseMessage.data.error) {
			throw new Error(giveClueResponseMessage.data.error);
		}

		// After responding to our initial message, the server will also send a
		// RefreshGameData message. We'll handle that in a separate handler.
	}

	public async giveNumberClue(to: string, number: HanabiTileNumber): Promise<void> {
		this._sendMessage({
			type: 'GiveClueMessage',
			data: { to, number },
		});

		const giveClueResponseMessage = await this._socketManager.expectMessageOfType<GiveClueResponseMessage>(
			'GiveClueResponseMessage',
		);

		if (giveClueResponseMessage.data.error) {
			throw new Error(giveClueResponseMessage.data.error);
		}

		// After responding to our initial message, the server will also send a
		// RefreshGameData message. We'll handle that in a separate handler.
	}
}
