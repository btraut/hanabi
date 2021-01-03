import { generatePlayer } from 'app/src/games/escape/EscapeGamePlayer';
import { ESCAPE_GAME_TITLE, MAP_SIZE } from 'app/src/games/escape/EscapeGameRules';
import EscapeGameStage from 'app/src/games/escape/EscapeGameStage';
import EscapeGameData from 'app/src/games/escape/server/EscapeGameData';
import GameMessenger from 'app/src/games/server/GameMessenger';
import UserConnectionListener, {
	UserConnectionChange,
} from 'app/src/games/server/UserConnectionListener';
import ServerSocketManager from 'app/src/utils/server/SocketManager';

import Game from '../../server/Game';
import {
	AddPlayerMessage,
	EscapeGameMessage,
	getScope,
	MovePlayerMessage,
	RemovePlayerMessage,
	StartGameMessage,
} from '../EscapeGameMessages';
import { locationIsInBounds, move } from '../Movement';

export default class EscapeGame extends Game {
	public static title = ESCAPE_GAME_TITLE;

	public static factory(
		userId: string,
		socketManager: ServerSocketManager<EscapeGameMessage>,
	): EscapeGame {
		return new EscapeGame(userId, socketManager);
	}

	private _stage: EscapeGameStage = EscapeGameStage.Open;

	private _gameData: EscapeGameData = new EscapeGameData();

	private _messenger: GameMessenger<EscapeGameMessage>;
	private _userConnectionListener: UserConnectionListener;

	constructor(userId: string, socketManager: ServerSocketManager<EscapeGameMessage>) {
		super(userId);

		this._messenger = new GameMessenger(
			getScope(ESCAPE_GAME_TITLE, this.id),
			socketManager,
			this._handleMessage,
		);

		this._userConnectionListener = new UserConnectionListener(
			socketManager,
			this._handleUserConnectionChange,
		);
	}

	public cleanUp(): void {
		this._messenger.cleanUp();
		this._userConnectionListener.cleanUp();
	}

	private _getAllPlayerAndWatcherIds(): string[] {
		return [...new Set([...this.watchers, ...Object.keys(this._gameData.players)])];
	}

	private _handleMessage = ({
		userId,
		message,
	}: {
		userId: string;
		message: EscapeGameMessage;
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
			case 'MovePlayerMessage':
				this._handleMovePlayerMessage(message, userId);
				break;
		}
	};

	private _handleUserConnectionChange = (userId: string, change: UserConnectionChange) => {
		if (!this._gameData.players[userId]) {
			return;
		}

		this._gameData.players[userId].connected = change === UserConnectionChange.Authenticated;

		this._messenger.send(this._getAllPlayerAndWatcherIds(), {
			scope: getScope(ESCAPE_GAME_TITLE, this.id),
			type: 'RefreshGameDataMessage',
			data: this._gameData.serialize(),
		});

		// Touch the games last updated time.
		this._update();
	};

	private _sendGameData(playerId: string): void {
		this._messenger.send(playerId, {
			scope: getScope(ESCAPE_GAME_TITLE, this.id),
			type: 'RefreshGameDataMessage',
			data: this._gameData.serialize(),
		});

		// Touch the games last updated time.
		this._update();
	}

	private _handleAddPlayerMessage({ data: { name } }: AddPlayerMessage, playerId: string): void {
		// Error if already started.
		if (this._stage !== EscapeGameStage.Open) {
			this._messenger.send(playerId, {
				scope: getScope(ESCAPE_GAME_TITLE, this.id),
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
		this._messenger.send(playerId, {
			scope: getScope(ESCAPE_GAME_TITLE, this.id),
			type: 'AddPlayerResponseMessage',
			data: {},
		});

		// Send the updated state to all players/watchers.
		this._messenger.send(this._getAllPlayerAndWatcherIds(), {
			scope: getScope(ESCAPE_GAME_TITLE, this.id),
			type: 'RefreshGameDataMessage',
			data: this._gameData.serialize(),
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
		if (this._stage !== EscapeGameStage.Open) {
			this._messenger.send(userId, {
				scope: getScope(ESCAPE_GAME_TITLE, this.id),
				type: 'RemovePlayerResponseMessage',
				data: {
					error: 'Cannot remove user from game because it has already started.',
				},
			});
			return;
		}

		delete this._gameData.players[removeUserId];

		this._messenger.send(userId, {
			scope: getScope(ESCAPE_GAME_TITLE, this.id),
			type: 'RemovePlayerResponseMessage',
			data: {},
		});

		// Send the updated state to all players/watchers.
		this._messenger.send(this._getAllPlayerAndWatcherIds(), {
			scope: getScope(ESCAPE_GAME_TITLE, this.id),
			type: 'RefreshGameDataMessage',
			data: this._gameData.serialize(),
		});

		// Touch the games last updated time.
		this._update();
	}

	private _handleStartGameMessage(_message: StartGameMessage, userId: string): void {
		// Error if already started.
		if (this._stage !== EscapeGameStage.Open) {
			this._messenger.send(userId, {
				scope: getScope(ESCAPE_GAME_TITLE, this.id),
				type: 'StartGameResponseMessage',
				data: {
					error: 'Cannot start game because it has already started.',
				},
			});
			return;
		}

		// Start the game!
		this._gameData.stage = EscapeGameStage.Started;

		// Send success message.
		this._messenger.send(userId, {
			scope: getScope(ESCAPE_GAME_TITLE, this.id),
			type: 'StartGameResponseMessage',
			data: {},
		});

		// Send the updated state to all players/watchers.
		this._messenger.send(this._getAllPlayerAndWatcherIds(), {
			scope: getScope(ESCAPE_GAME_TITLE, this.id),
			type: 'RefreshGameDataMessage',
			data: this._gameData.serialize(),
		});

		// Touch the games last updated time.
		this._update();
	}

	private _handleMovePlayerMessage(
		{ data: { playerId, direction } }: MovePlayerMessage,
		userId: string,
	): void {
		const movingPlayerId = playerId || userId;
		const movingPlayer = this._gameData.players[movingPlayerId];

		if (!this._gameData.players[movingPlayerId]) {
			this._messenger.send(userId, {
				scope: getScope(ESCAPE_GAME_TITLE, this.id),
				type: 'MovePlayerResponseMessage',
				data: { error: 'Invalid player id.' },
			});
			return;
		}

		// Send success message.
		this._messenger.send(userId, {
			scope: getScope(ESCAPE_GAME_TITLE, this.id),
			type: 'MovePlayerResponseMessage',
			data: {},
		});

		// Move the player.
		const newCoordinates = move(movingPlayer.location, direction);
		if (locationIsInBounds(newCoordinates, MAP_SIZE)) {
			movingPlayer.location = newCoordinates;
		}

		// Send the updated state to all players/watchers.
		this._messenger.send(this._getAllPlayerAndWatcherIds(), {
			scope: getScope(ESCAPE_GAME_TITLE, this.id),
			type: 'RefreshGameDataMessage',
			data: this._gameData.serialize(),
		});

		// Touch the games last updated time.
		this._update();
	}
}
