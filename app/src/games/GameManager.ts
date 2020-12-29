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
		this._games[id].cleanUp();
		delete this._games[id];
	}

	public prune(olderThan = 60 * 60 * 1000): Game[] {
		const oldestGameTime = new Date(new Date().getTime() - olderThan);

		// Iterate over all games and collect pruned entries.
		const prunedEntries = [];
		for (const game of Object.values(this._games)) {
			if (game.updated < oldestGameTime) {
				prunedEntries.push(game);
				this.removeGame(game.id);
			}
		}

		// Send back a list of all we've pruned.
		return prunedEntries;
	}
}
