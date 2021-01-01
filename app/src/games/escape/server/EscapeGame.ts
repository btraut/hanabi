import EscapeGamePlayer from 'app/src/games/escape/EscapeGamePlayer';
import { ESCAPE_GAME_TITLE, MAP_SIZE } from 'app/src/games/escape/EscapeGameRules';
import EscapeGameStage from 'app/src/games/escape/EscapeGameStage';
import EscapeGameData from 'app/src/games/escape/server/EscapeGameData';
import GameMessenger from 'app/src/games/server/GameMessenger';
import ServerSocketManager from 'app/src/utils/server/SocketManager';

import Game from '../../Game';
import {
	AddPlayerMessage,
	AddPlayerResponseMessage,
	ChangeGameStageMessage,
	EscapeGameMessage,
	GetGameDataResponseMessage,
	getScope,
	MovePlayerMessage,
	PlayerAddedMessage,
	PlayerMovedMessage,
	PlayerRemovedMessage,
	RemovePlayerMessage,
	RemovePlayerResponseMessage,
	StartGameMessage,
	StartGameResponseMessage,
} from '../EscapeGameMessages';
import { checkBounds, Location, move } from '../Movement';

export default class EscapeGame extends Game {
	public static title = ESCAPE_GAME_TITLE;

	public static factory(userId: string, socketManager: ServerSocketManager): EscapeGame {
		return new EscapeGame(userId, socketManager);
	}

	private _stage: EscapeGameStage = EscapeGameStage.Open;

	private _gameData: EscapeGameData = new EscapeGameData();

	private _messenger: GameMessenger<EscapeGameMessage>;

	constructor(userId: string, socketManager: ServerSocketManager) {
		super(userId);

		this._gameData.id = this.id;
		this._gameData.code = this.code;
		this._gameData.map = new Array(MAP_SIZE.width)
			.fill('')
			.map(() => new Array(MAP_SIZE.height).fill('').map(() => []));

		this._messenger = new GameMessenger(
			getScope(ESCAPE_GAME_TITLE, this.id),
			socketManager,
			this._handleMessage,
		);
	}

	public cleanUp(): void {
		this._messenger.cleanUp();
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

	private _sendGameData(playerId: string): void {
		const getGameDataResponseMessage: GetGameDataResponseMessage = {
			scope: getScope(ESCAPE_GAME_TITLE, this.id),
			type: 'GetGameDataResponseMessage',
			data: this._gameData.serialize(),
		};
		this._messenger.send(playerId, getGameDataResponseMessage);

		// Touch the games last updated time.
		this._update();
	}

	private _handleAddPlayerMessage({ data: { name } }: AddPlayerMessage, playerId: string): void {
		// Error if already started.
		if (this._stage !== EscapeGameStage.Open) {
			const errorAlreadyStarted: AddPlayerResponseMessage = {
				scope: getScope(ESCAPE_GAME_TITLE, this.id),
				type: 'AddPlayerResponseMessage',
				data: {
					error: 'Cannot join game because it has already started.',
				},
			};
			this._messenger.send(playerId, errorAlreadyStarted);
			return;
		}

		// Add the player to the map.
		this._gameData.map[0][0].push(playerId);

		// Add the player to the player list.
		const player: EscapeGamePlayer = {
			id: playerId,
			name,
		};

		this._gameData.players[playerId] = player;

		// Success! Respond to the creator.
		const successMessage: AddPlayerResponseMessage = {
			scope: getScope(ESCAPE_GAME_TITLE, this.id),
			type: 'AddPlayerResponseMessage',
			data: {},
		};
		this._messenger.send(playerId, successMessage);

		// Send the new player to all players (including the creator).
		const playerAddedMessage: PlayerAddedMessage = {
			scope: getScope(ESCAPE_GAME_TITLE, this.id),
			type: 'PlayerAddedMessage',
			data: {
				playerId,
				player,
			},
		};
		this._messenger.send(this._getAllPlayerAndWatcherIds(), playerAddedMessage);

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
			const errorAlreadyStarted: RemovePlayerResponseMessage = {
				scope: getScope(ESCAPE_GAME_TITLE, this.id),
				type: 'RemovePlayerResponseMessage',
				data: {
					error: 'Cannot remove user from game because it has already started.',
				},
			};
			this._messenger.send(userId, errorAlreadyStarted);
			return;
		}

		// Remove the player from the map.
		const playerCoordinates = this._getPlayerCoordinates(removeUserId);
		if (playerCoordinates) {
			const { x, y } = playerCoordinates;
			this._gameData.map[x][y] = this._gameData.map[x][y].filter((id) => id !== playerId);
		}

		const allPlayers = this._getAllPlayerAndWatcherIds();

		delete this._gameData.players[removeUserId];

		const removePlayerResponseMessage: RemovePlayerResponseMessage = {
			scope: this.id,
			type: 'RemovePlayerResponseMessage',
			data: {},
		};
		this._messenger.send(userId, removePlayerResponseMessage);

		// Send the removed player to all players (including the remover).
		const playerRemovedMessage: PlayerRemovedMessage = {
			scope: getScope(ESCAPE_GAME_TITLE, this.id),
			type: 'PlayerRemovedMessage',
			data: {
				playerId: removeUserId,
			},
		};
		this._messenger.send(allPlayers, playerRemovedMessage);

		// Touch the games last updated time.
		this._update();
	}

	private _handleStartGameMessage(_message: StartGameMessage, userId: string): void {
		// Error if already started.
		if (this._stage !== EscapeGameStage.Open) {
			const errorAlreadyStarted: StartGameResponseMessage = {
				scope: getScope(ESCAPE_GAME_TITLE, this.id),
				type: 'StartGameResponseMessage',
				data: {
					error: 'Cannot start game because it has already started.',
				},
			};
			this._messenger.send(userId, errorAlreadyStarted);
			return;
		}

		// Start the game!
		this._gameData.stage = EscapeGameStage.Started;

		// Send success message.
		const startGameResponseMessage: StartGameResponseMessage = {
			scope: this.id,
			type: 'StartGameResponseMessage',
			data: {},
		};
		this._messenger.send(userId, startGameResponseMessage);

		// Send the stage change to all players (including the remover).
		const changeGameStageMessage: ChangeGameStageMessage = {
			scope: getScope(ESCAPE_GAME_TITLE, this.id),
			type: 'ChangeGameStageMessage',
			data: {
				stage: this._gameData.stage,
			},
		};
		this._messenger.send(this._getAllPlayerAndWatcherIds(), changeGameStageMessage);

		// Touch the games last updated time.
		this._update();
	}

	private _getPlayerCoordinates(playerId: string): Location | null {
		for (let x = 0; x < this._gameData.map.length; x += 1) {
			for (let y = 0; y < this._gameData.map[x].length; y += 1) {
				if (this._gameData.map[x][y].includes(playerId)) {
					return { x, y };
				}
			}
		}

		return null;
	}

	private _handleMovePlayerMessage(
		{ data: { playerId, direction } }: MovePlayerMessage,
		_userId: string,
	): void {
		const playerCoordinates = this._getPlayerCoordinates(playerId);
		if (!playerCoordinates) {
			return;
		}

		const newCoordinates = move(playerCoordinates, direction);
		if (checkBounds(newCoordinates, MAP_SIZE)) {
			return;
		}

		const { x: oldX, y: oldY } = playerCoordinates;
		this._gameData.map[oldX][oldY] = this._gameData.map[oldX][oldY].filter((id) => id !== playerId);

		const { x: newX, y: newY } = newCoordinates;
		this._gameData.map[newX][newY].push(playerId);

		const playerMovedMessage: PlayerMovedMessage = {
			scope: this.id,
			type: 'PlayerMovedMessage',
			data: { playerId, to: newCoordinates },
		};
		this._messenger.send(this._getAllPlayerAndWatcherIds(), playerMovedMessage);

		// Touch the games last updated time.
		this._update();
	}
}
