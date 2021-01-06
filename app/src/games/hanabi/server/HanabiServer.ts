import {
	generateHanabiGameData,
	generatePlayer,
	HANABI_GAME_TITLE,
	HanabiGameData,
	HanabiStage,
} from 'app/src/games/hanabi/HanabiGameData';
import {
	AddPlayerMessage,
	DiscardTileMessage,
	getScope,
	GiveClueMessage,
	HanabiMessage,
	MoveTileMessage,
	PlayTileMessage,
	RemovePlayerMessage,
	StartGameMessage,
} from 'app/src/games/hanabi/HanabiMessages';
import Game from 'app/src/games/server/Game';
import GameMessenger from 'app/src/games/server/GameMessenger';
import UserConnectionListener, {
	UserConnectionChange,
} from 'app/src/games/server/UserConnectionListener';
import ServerSocketManager from 'app/src/utils/server/SocketManager';

// https://davidgomes.com/pick-omit-over-union-types-in-typescript/
type DistributiveOmit<T, K extends keyof T> = T extends unknown ? Omit<T, K> : never;

export default class HanabiGame extends Game {
	public static title = HANABI_GAME_TITLE;

	public static factory(
		userId: string,
		socketManager: ServerSocketManager<HanabiMessage>,
	): HanabiGame {
		return new HanabiGame(userId, socketManager);
	}

	private _stage = HanabiStage.Setup;

	private _gameData: HanabiGameData = generateHanabiGameData();

	private _messenger: GameMessenger<HanabiMessage>;
	private _userConnectionListener: UserConnectionListener;

	constructor(userId: string, socketManager: ServerSocketManager<HanabiMessage>) {
		super(userId);

		this._messenger = new GameMessenger(socketManager, getScope(HANABI_GAME_TITLE, this.id));
		this._messenger.connect(this._handleMessage);

		this._userConnectionListener = new UserConnectionListener(socketManager);
		this._userConnectionListener.start(this._handleUserConnectionChange);
	}

	public cleanUp(): void {
		this._messenger.disconnect();
		this._userConnectionListener.stop();
	}

	private _getAllPlayerAndWatcherIds(): string[] {
		return [...new Set([...this.watchers, ...Object.keys(this._gameData.players)])];
	}

	private _handleMessage = ({
		userId,
		message,
	}: {
		userId: string;
		message: HanabiMessage;
	}): void => {
		switch (message.type) {
			case 'GetGameDataMessage':
				this._sendGameData(userId);
				break;
			case 'AddPlayerMessage':
				this._handleAddPlayerMessage(message, userId);
				break;
			case 'RemovePlayerMessage':
				this._handleRemovePlayerMessage(message, userId);
				break;
			case 'StartGameMessage':
				this._handleStartGameMessage(message, userId);
				break;
			case 'PlayTileMessage':
				this._handlePlayTileMessage(message, userId);
				break;
			case 'DiscardTileMessage':
				this._handleDiscardTileMessage(message, userId);
				break;
			case 'GiveClueMessage':
				this._handleGiveClueMessage(message, userId);
				break;
			case 'MoveTileMessage':
				this._handleMoveTileMessage(message, userId);
				break;
		}
	};

	private _sendMessage(
		userIdOrIds: string | readonly string[],
		message: DistributiveOmit<HanabiMessage, 'scope'>,
	) {
		this._messenger.send(userIdOrIds, {
			...message,
			scope: getScope(HANABI_GAME_TITLE, this.id),
		});
	}

	private _handleUserConnectionChange = (userId: string, change: UserConnectionChange) => {
		if (!this._gameData.players[userId]) {
			return;
		}

		this._gameData.players[userId].connected = change === UserConnectionChange.Authenticated;

		this._sendMessage(this._getAllPlayerAndWatcherIds(), {
			type: 'RefreshGameDataMessage',
			data: this._gameData,
		});

		// Touch the games last updated time.
		this._update();
	};

	private _sendGameData(playerId: string): void {
		this._sendMessage(playerId, {
			type: 'RefreshGameDataMessage',
			data: this._gameData,
		});

		// Touch the games last updated time.
		this._update();
	}

	private _handleAddPlayerMessage({ data: { name } }: AddPlayerMessage, playerId: string): void {
		// Error if already started.
		if (this._stage !== HanabiStage.Setup) {
			this._sendMessage(playerId, {
				type: 'AddPlayerResponseMessage',
				data: {
					error: 'Cannot join game because it has already started.',
				},
			});
			return;
		}

		// Add the player to the player list.
		const player = generatePlayer({ id: playerId, name });
		this._gameData.players[playerId] = player;

		// Success! Respond to the creator.
		this._sendMessage(playerId, {
			type: 'AddPlayerResponseMessage',
			data: {},
		});

		// Send the updated state to all players/watchers.
		this._sendMessage(this._getAllPlayerAndWatcherIds(), {
			type: 'RefreshGameDataMessage',
			data: this._gameData,
		});

		// Touch the games last updated time.
		this._update();
	}

	private _handleRemovePlayerMessage(
		{ data: { playerId } }: RemovePlayerMessage,
		userId: string,
	): void {
		const removeUserId = playerId || userId;

		// Error if already started.
		if (this._stage !== HanabiStage.Setup) {
			this._sendMessage(userId, {
				type: 'RemovePlayerResponseMessage',
				data: {
					error: 'Cannot remove user from game because it has already started.',
				},
			});
			return;
		}

		delete this._gameData.players[removeUserId];

		this._sendMessage(userId, {
			type: 'RemovePlayerResponseMessage',
			data: {},
		});

		// Send the updated state to all players/watchers.
		this._sendMessage(this._getAllPlayerAndWatcherIds(), {
			type: 'RefreshGameDataMessage',
			data: this._gameData,
		});

		// Touch the games last updated time.
		this._update();
	}

	private _handleStartGameMessage(_message: StartGameMessage, userId: string): void {
		// Error if already started.
		if (this._stage !== HanabiStage.Setup) {
			this._sendMessage(userId, {
				type: 'StartGameResponseMessage',
				data: {
					error: 'Cannot start game because it has already started.',
				},
			});
			return;
		}

		// Start the game!
		this._gameData.stage = HanabiStage.Playing;

		// Send success message.
		this._sendMessage(userId, {
			type: 'StartGameResponseMessage',
			data: {},
		});

		// Send the updated state to all players/watchers.
		this._sendMessage(this._getAllPlayerAndWatcherIds(), {
			type: 'RefreshGameDataMessage',
			data: this._gameData,
		});

		// Touch the games last updated time.
		this._update();
	}

	private _validateGameAction(userId: string): string | null {
		if (!this._gameData.players[userId]) {
			return 'Invalid player!';
		}

		if (this._gameData.stage !== HanabiStage.Playing) {
			return 'The game isn’t being played right now.';
		}

		if (this._gameData.turnOrder[0] !== userId) {
			return 'It’s not your turn!';
		}

		return null;
	}

	private _handlePlayTileMessage(_message: PlayTileMessage, userId: string): void {
		const gameActionError = this._validateGameAction(userId);
		if (gameActionError) {
			this._sendMessage(userId, {
				type: 'PlayTileResponseMessage',
				data: { error: gameActionError },
			});
			return;
		}
	}

	private _handleDiscardTileMessage(_message: DiscardTileMessage, userId: string): void {
		const gameActionError = this._validateGameAction(userId);
		if (gameActionError) {
			this._sendMessage(userId, {
				type: 'PlayTileResponseMessage',
				data: { error: gameActionError },
			});
			return;
		}
	}

	private _handleGiveClueMessage(_message: GiveClueMessage, userId: string): void {
		const gameActionError = this._validateGameAction(userId);
		if (gameActionError) {
			this._sendMessage(userId, {
				type: 'PlayTileResponseMessage',
				data: { error: gameActionError },
			});
			return;
		}
	}

	private _handleMoveTileMessage(_message: MoveTileMessage, _userId: string): void {
		// TODO
	}
}
