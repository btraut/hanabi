import * as uuid from 'uuid';

export type Owner = string;
export type Player = string;

export enum GameState {
	WaitingForPlayers,
	Starting,
	WaitingForSubmissions,
	AllSubmissionsRecieved,
	ReviewStories,
	PlayAgain
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
	private _players: Player[] = [];
	private _owner: Owner;
	private _code: string = this._generateCode();
	private _state = GameState.WaitingForPlayers;
	
	constructor(owner: Owner) {
		this._owner = owner;
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
	
	public addPlayer(player: Player) {
		if (this._players.indexOf(player) !== -1) {
			this._players.push(player);
		}
		
		this._updated = new Date();
	}
}
