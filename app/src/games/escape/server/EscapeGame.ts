import EscapeGamePlayer from 'app/src/games/escape/EscapeGamePlayer';
import EscapeGameStage from 'app/src/games/escape/EscapeGameStage';
import EscapeGameData from 'app/src/games/escape/server/EscapeGameData';
import GameMessenger from 'app/src/games/server/GameMessenger';
import ServerSocketManager from 'app/src/utils/server/SocketManager';

import Game from '../../Game';
import {
	AddPlayerMessage,
	AddPlayerResponseMessage,
	EscapeGameMessage,
	GetGameDataResponseMessage,
	getScope,
	MovePlayerMessage,
	PlayerAddedMessage,
	PlayerMovedMessage,
	// PlayerRemovedMessage,
} from '../EscapeGameMessages';
import { checkBounds, Location, move, Size } from '../Movement';

const MAP_SIZE: Size = { width: 10, height: 6 };

export const ESCAPE_GAME_TITLE = 'escape';

export default class EscapeGame extends Game {
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
				scope: this.id,
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
			scope: this.id,
			type: 'AddPlayerResponseMessage',
			data: {},
		};
		this._messenger.send(Object.keys(this._gameData.players), successMessage);

		// Send the new player to all players (including the creator).
		const playerAddedMessage: PlayerAddedMessage = {
			scope: this.id,
			type: 'PlayerAddedMessage',
			data: {
				playerId,
				player,
			},
		};
		this._messenger.send(Object.keys(this._gameData.players), playerAddedMessage);

		// Touch the games last updated time.
		this._update();
	}

	/*
	private _removePlayer(playerId: string): void {
		// Remove the player from the map.
		const playerCoordinates = this._getPlayerCoordinates(playerId);
		if (playerCoordinates) {
			const { x, y } = playerCoordinates;
			this._gameData.map[x][y] = this._gameData.map[x][y].filter((id) => id !== playerId);
		}

		// Send the update to players.
		const playerRemovedMessage: PlayerRemovedMessage = {
			scope: this.id,
			type: 'PlayerRemovedMessage',
			data: {
				playerId,
			},
		};
		this._messenger.send(Object.keys(this._gameData.players), playerRemovedMessage);

		// Touch the games last updated time.
		this._update();
	}
	*/

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
		this._messenger.send(Object.keys(this._gameData.players), playerMovedMessage);

		// Touch the games last updated time.
		this._update();
	}
}
