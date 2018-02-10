import * as uuid from 'uuid';

import Player from './Player';

export enum GameState {
	WaitingForPlayers,
	WaitingForPlayerDescriptions,
	WaitingForTextSubmissions,
	WaitingForPictureSubmissions,
	AllSubmissionsRecieved,
	ReviewingStories,
	PlayAgainOptions
}

export interface GameData {
	readonly code: string;
	readonly state: GameState;
	readonly owner: Player;
	readonly players: Player[];
}

export class Game {
	public get created() { return this._created; }
	public get updated() { return this._updated; }
	public get owner() { return this._owner; }
	public get players() { return this._players; }
	public get code() { return this._code; }
	public get state() { return this._state; }
	
	private _created = new Date();
	private _updated = new Date();
	private _players: { [playerId: string]: Player } = {};
	private _owner: Player;
	private _code: string = this._generateCode();
	private _state = GameState.WaitingForPlayers;
	
	constructor(ownerId: string) {
		this._owner = {
			name: 'owner',
			id: ownerId,
			connected: true
		};
	}
	
	public toObject(): GameData {
		return {
			code: this._code,
			state: this._state,
			owner: this._owner,
			players: Object.values(this._players)
		};
	}
	
	private _generateCode() {
		// TODO: Don't use annoying letters.
		this._code = uuid().substr(0, 6);
		return this._code;
	}
	
	public regenerateCode() {
		this._generateCode();
		return this._code;
	}
	
	public addPlayer(playerId: string, name = '') {
		if (!this._players[playerId]) {
			this._players[playerId] = {
				id: playerId,
				name,
				connected: true
			};
		}
		
		this._updated = new Date();
		
		return this._players[playerId];
	}
	
	public updatePlayer(playerId: string, updates: Partial<Player>): Player | undefined {
		const updatedPlayer = this._players[playerId];
		if (updatedPlayer) {
			this._players[playerId] = { ...updatedPlayer, ...updates };
		}
		
		this._updated = new Date();
		
		return this._players[playerId];
	}
	
	public removePlayer(playerId: string) {
		const removedPlayer = this._players[playerId];
		
		if (removedPlayer) {
			delete this._players[playerId];
		}
		
		this._updated = new Date();
		
		return removedPlayer;
	}
	
	public updateOwner(updates: Partial<Player>) {
		this._owner = { ...this._owner, ...updates };
		
		this._updated = new Date();
		
		return this._owner;
	}
}
