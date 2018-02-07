import * as uuid from 'uuid';

import GameState from './GameState';

export interface GameObject {
	code: string;
	state: GameState;
}

export class Game {
	public get created() { return this._created; }
	public get updated() { return this._updated; }
	public get ownerId() { return this._ownerId; }
	public get players() { return this._playerIds; }
	public get code() { return this._code; }
	public get state() { return this._state; }
	
	private _created = new Date();
	private _updated = new Date();
	private _playerIds: string[] = [];
	private _ownerId: string;
	private _code: string = this._generateCode();
	private _state = GameState.WaitingForPlayers;
	
	constructor(ownerId: string) {
		this._ownerId = ownerId;
	}
	
	public toObject(): GameObject {
		return {
			code: this._code,
			state: this._state
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
	
	public addPlayer(playerId: string) {
		if (this._playerIds.indexOf(playerId) !== -1) {
			this._playerIds.push(playerId);
		}
		
		this._updated = new Date();
	}
}
