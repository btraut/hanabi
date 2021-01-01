import GameManager from 'app/src/games/client/GameManager';
import {
	AddPlayerMessage,
	AddPlayerResponseMessage,
	EscapeGameMessage,
	GetGameDataMessage,
	GetGameDataResponseMessage,
	getScope,
	RemovePlayerMessage,
	RemovePlayerResponseMessage,
	StartGameMessage,
	StartGameResponseMessage,
} from 'app/src/games/escape/EscapeGameMessages';
import EscapeGamePlayer from 'app/src/games/escape/EscapeGamePlayer';
import { ESCAPE_GAME_TITLE } from 'app/src/games/escape/EscapeGameRules';
import EscapeGameStage from 'app/src/games/escape/EscapeGameStage';
import { SerialEscapeGameData } from 'app/src/games/escape/server/EscapeGameData';
import ClientSocketManager from 'app/src/utils/client/SocketManager';

export default class EscapeGameManager extends GameManager {
	// Children must override.
	protected get _title(): string {
		return ESCAPE_GAME_TITLE;
	}

	protected _gameData: SerialEscapeGameData | null = null;
	public get gameData(): SerialEscapeGameData | null {
		return this._gameData;
	}

	private _socketManagerOnMessageSubscriptionId: number | null = null;

	constructor(socketManager: ClientSocketManager) {
		super(socketManager);

		this._socketManagerOnMessageSubscriptionId = socketManager.onMessage.subscribe(
			this._handleMessage,
		);
	}

	public cleanUp(): void {
		if (this._socketManagerOnMessageSubscriptionId !== null) {
			this._socketManager.onMessage.unsubscribe(this._socketManagerOnMessageSubscriptionId);
			this._socketManagerOnMessageSubscriptionId = null;
		}
	}

	private _handleMessage = (message: EscapeGameMessage) => {
		if (!this._gameId || message.scope !== getScope(this._title, this._gameId)) {
			return;
		}

		switch (message.type) {
			case 'PlayerAddedMessage':
				this._handlePlayerAdded(message.data.playerId, message.data.player);
				break;
			case 'PlayerRemovedMessage':
				this._handlePlayerRemoved(message.data.playerId);
				break;
			case 'ChangeGameStageMessage':
				this._handleChangeStage(message.data.stage);
				break;
		}
	};

	private _handlePlayerAdded(playerId: string, player: EscapeGamePlayer) {
		if (!this._gameData) {
			return;
		}

		this._gameData.players[playerId] = player;

		this.onUpdate.emit();
	}

	private _handlePlayerRemoved(playerId: string) {
		if (!this._gameData) {
			return;
		}

		delete this._gameData.players[playerId];

		this.onUpdate.emit();
	}

	private _handleChangeStage(stage: EscapeGameStage) {
		if (!this._gameData) {
			return;
		}

		this._gameData.stage = stage;

		this.onUpdate.emit();
	}

	public async join(name: string): Promise<void> {
		if (!this._gameId) {
			throw new Error('Cannot add a player without a game.');
		}

		// Attempt to watch the game using the game code.
		const addPlayerMessage: AddPlayerMessage = {
			scope: getScope(this._title, this._gameId),
			type: 'AddPlayerMessage',
			data: { name },
		};
		this._socketManager.send(addPlayerMessage);

		const addPlayerResponseMessage = await this._socketManager.expectMessageOfType<AddPlayerResponseMessage>(
			'AddPlayerResponseMessage',
		);

		if (addPlayerResponseMessage.data.error) {
			throw new Error(addPlayerResponseMessage.data.error);
		}
	}

	public async leave(): Promise<void> {
		if (!this._gameId) {
			throw new Error('Cannot remove a player without a game.');
		}

		// Attempt to watch the game using the game code.
		const removePlayerMessage: RemovePlayerMessage = {
			scope: getScope(this._title, this._gameId),
			type: 'RemovePlayerMessage',
			data: {},
		};
		this._socketManager.send(removePlayerMessage);

		const removePlayerResponseMessage = await this._socketManager.expectMessageOfType<RemovePlayerResponseMessage>(
			'RemovePlayerResponseMessage',
		);

		if (removePlayerResponseMessage.data.error) {
			throw new Error(removePlayerResponseMessage.data.error);
		}
	}

	public async start(): Promise<void> {
		if (!this._gameId) {
			throw new Error('Cannot start game without a game.');
		}

		// Attempt to watch the game using the game code.
		const startGameMessage: StartGameMessage = {
			scope: getScope(this._title, this._gameId),
			type: 'StartGameMessage',
			data: undefined,
		};
		this._socketManager.send(startGameMessage);

		const startGameResponseMessage = await this._socketManager.expectMessageOfType<StartGameResponseMessage>(
			'StartGameResponseMessage',
		);

		if (startGameResponseMessage.data.error) {
			throw new Error(startGameResponseMessage.data.error);
		}
	}

	public async refreshGameData(): Promise<void> {
		if (!this._gameId) {
			throw new Error('Game must be started/loaded first.');
		}

		const getGameDataMessage: GetGameDataMessage = {
			scope: getScope(this._title, this._gameId),
			type: 'GetGameDataMessage',
			data: undefined,
		};
		this._socketManager.send(getGameDataMessage);

		const getStateResponseMessage = await this._socketManager.expectMessageOfType<GetGameDataResponseMessage>(
			'GetGameDataResponseMessage',
		);

		this._gameData = getStateResponseMessage.data;

		this.onUpdate.emit();
	}
}
