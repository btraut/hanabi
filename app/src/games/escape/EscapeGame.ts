import GameMessenger from 'app/src/games/GameMessenger';
import { SocketMessageBase } from 'app/src/models/SocketMessage';
import ServerSocketManager from 'app/src/utils/ServerSocketManager';

import Game from '../Game';
import {
	EscapeGameMessage,
	PlayerAddedMessage,
	PlayerMovedMessage,
	PlayerRemovedMessage,
	ResetStateMessage,
} from './EscapeGameMessages';
import { checkBounds, Direction, Location, move, Size } from './Movement';
import Player from './Player';

const MAP_SIZE: Size = { width: 10, height: 6 };

export default class EscapeGame extends Game {
	private _map: string[][][] = new Array(MAP_SIZE.width).map(() =>
		new Array(MAP_SIZE.height).map(() => []),
	);

	private _players: { [id: string]: Player } = {};

	private _messenger: GameMessenger<EscapeGameMessage>;

	get map(): readonly (readonly (readonly string[])[])[] {
		return this._map;
	}

	constructor(socketManager: ServerSocketManager<SocketMessageBase>) {
		super();

		this._messenger = new GameMessenger(this.id, socketManager, this._handleMessage);
	}

	public cleanUp(): void {
		this._messenger.cleanUp();
	}

	private _handleMessage({
		userId,
		message,
	}: {
		userId: string;
		message: EscapeGameMessage;
	}): void {
		switch (message.type) {
			case 'getState':
				this._sendState(userId);
				break;
			case 'addPlayer':
				this._addPlayer(userId, message.data.name);
				break;
			case 'removePlayer':
				this._removePlayer(message.data.playerId);
				break;
			case 'movePlayer':
				this._movePlayer(message.data.playerId, message.data.direction);
				break;
		}
	}

	private _sendState(playerId: string): void {
		const resetStateMessage: ResetStateMessage = {
			scope: this.id,
			type: 'resetState',
			data: {
				map: this._map,
				players: this._players,
			},
		};
		this._messenger.send(playerId, resetStateMessage);
	}

	private _addPlayer(playerId: string, name: string): void {
		// Add the player to the map.
		this._map[0][0].push(playerId);

		// Add the player to the player list.
		const player: Player = {
			name,
		};

		this._players[playerId] = player;

		// Send the update to players.
		const playerAddedMessage: PlayerAddedMessage = {
			scope: this.id,
			type: 'playerAdded',
			data: {
				playerId,
				player,
			},
		};
		this._messenger.send(Object.keys(this._players), playerAddedMessage);
	}

	private _removePlayer(playerId: string): void {
		// Remove the player from the map.
		const playerCoordinates = this._getPlayerCoordinates(playerId);
		if (playerCoordinates) {
			const { x, y } = playerCoordinates;
			this._map[x][y] = this._map[x][y].filter((id) => id !== playerId);
		}

		// Send the update to players.
		const playerRemovedMessage: PlayerRemovedMessage = {
			scope: this.id,
			type: 'playerRemoved',
			data: {
				playerId,
			},
		};
		this._messenger.send(Object.keys(this._players), playerRemovedMessage);
	}

	private _getPlayerCoordinates(playerId: string): Location | null {
		for (let x = 0; x < this._map.length; x += 1) {
			for (let y = 0; y < this._map[x].length; y += 1) {
				if (this.map[x][y].includes(playerId)) {
					return { x, y };
				}
			}
		}

		return null;
	}

	private _movePlayer(playerId: string, direction: Direction): void {
		const playerCoordinates = this._getPlayerCoordinates(playerId);
		if (!playerCoordinates) {
			return;
		}

		const newCoordinates = move(playerCoordinates, direction);
		if (checkBounds(newCoordinates, MAP_SIZE)) {
			return;
		}

		const { x: oldX, y: oldY } = playerCoordinates;
		this._map[oldX][oldY] = this._map[oldX][oldY].filter((id) => id !== playerId);

		const { x: newX, y: newY } = newCoordinates;
		this._map[newX][newY].push(playerId);

		const playerMovedMessage: PlayerMovedMessage = {
			scope: this.id,
			type: 'playerMoved',
			data: { playerId, to: newCoordinates },
		};
		this._messenger.send(Object.keys(this._players), playerMovedMessage);
	}
}
