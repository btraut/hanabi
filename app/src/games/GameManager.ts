import Game from './Game';

export default class GameManager {
	private _games: Game[] = [];
	get games(): readonly Game[] {
		return this._games;
	}
}
