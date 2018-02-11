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
	readonly host: Player;
	readonly players: Player[];
}

export class Game {
	public get created() { return this._created; }
	public get updated() { return this._updated; }
	public get host() { return this._host; }
	public get players() { return this._players; }
	public get code() { return this._code; }
	public get state() { return this._state; }
	
	private _created = new Date();
	private _updated = new Date();
	private _players: { [playerId: string]: Player } = {};
	private _host: Player;
	private _code: string = this._generateCode();
	private _state = GameState.WaitingForPlayers;
	
	constructor(hostId: string) {
		this._host = {
			name: 'host',
			id: hostId,
			connected: true
		};
	}
	
	public toObject(): GameData {
		return {
			code: this._code,
			state: this._state,
			host: this._host,
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
	
	public updateHost(updates: Partial<Player>) {
		this._host = { ...this._host, ...updates };
		
		this._updated = new Date();
		
		return this._host;
	}
}
