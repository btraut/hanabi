import Game from 'app/src/games/server/Game';

export interface SaveGameDelegate {
	saveGame: (game: Game) => Promise<void>;
	deleteGame: (game: Game) => Promise<void>;
}
