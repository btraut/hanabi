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
	readonly players: Player[];
}

export class Game {
	public get created() { return this._created; }
	public get updated() { return this._updated; }
	public get ownerId() { return this._ownerId; }
	public get players() { return this._players; }
	public get code() { return this._code; }
	public get state() { return this._state; }
	
	private _created = new Date();
	private _updated = new Date();
	private _players: Player[] = [];
	private _ownerId: string;
	private _code: string = this._generateCode();
	private _state = GameState.WaitingForPlayers;
	
	constructor(ownerId: string) {
		this._ownerId = ownerId;
	}
	
	public toObject(): GameData {
		return {
			code: this._code,
			state: this._state,
			players: this._players
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
		let player = this._players.find(p => p.id === playerId);
	
		if (!player) {
			player = {
				id: playerId,
				name
			};
			
			this._players.push(player);
		}
		
		this._updated = new Date();
		
		return player;
	}
	
	public removePlayer(playerId: string) {
		const removedPlayer = this._players.find(player => player.id === playerId);
		
		if (removedPlayer) {
			this._players = this._players.filter(player => player !== removedPlayer);
		}
		
		this._updated = new Date();
		
		return removedPlayer;
	}
}
