import { Game, Owner } from './Game';

class GameManager {
	private _games: { [code: string]: Game } = {};
	public get games() { return this._games; }
	
	public startNewGame(owner: Owner) {
		// Make a new game.
		const newGame = new Game(owner);
		
		// Make sure the game code is unique.
		while (this._games[newGame.code]) {
			newGame.regenerateCode();
		}
		
		// Save the new game in the games list and return it.
		this._games[newGame.code] = newGame;
		return newGame;
	}
	
	public pruneOldGames() {
		// Games older than an hour should be deleted.
		const oldestGameTime = new Date((new Date()).getTime() - 60 * 60 * 1000);
		
		// Iterate over all games and collect ids of pruned entries.
		const prunedEntries = [];
		for (const code of Object.keys(this._games)) {
			const game = this._games[code];
			
			if (game.updated < oldestGameTime) {
				prunedEntries.push(this._games[code]);
				delete this._games[code];
			}
		}
		
		return prunedEntries;
	}
}

const instance = new GameManager();
export default instance;
