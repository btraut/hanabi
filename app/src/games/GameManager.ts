import Game from './Game';

export default class GameManager {
	private _games: { [id: string]: Game } = {};
	get games(): { [id: string]: Game } {
		return this._games;
	}

	public addGame(game: Game): void {
		this._games[game.id] = game;
	}

	public removeGame(id: string): void {
		delete this._games[id];
	}
}
