import { v1 as uuidv1 } from 'uuid';

export default class Game {
	private _gameId = uuidv1();
	get gameId(): string {
		return this._gameId;
	}

	private _created = new Date();
	get created(): Date {
		return this._created;
	}

	private _playerIds: string[] = [];
	get playerIds(): readonly string[] {
		return this._playerIds;
	}

	// Child classes can override, but should call super.
	public addPlayer(id: string): void {
		this._playerIds.push(id);
	}

	// Child classes can override, but should call super.
	public removePlayer(id: string): void {
		this._playerIds = this._playerIds.filter((player) => player !== id);
	}
}
