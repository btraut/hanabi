import Game from 'app/src/games/server/Game';
import { SaveGameDelegate } from 'app/src/games/server/GameStore';
import ServerSocketManager from 'app/src/utils/server/SocketManager';

export default class GameFactory {
	public get title(): string {
		throw new Error('Subclasses must override.');
	}

	public create(
		_creatorId: string,
		_socketManager: ServerSocketManager<any>,
		_saveGameDelegate: SaveGameDelegate,
	): Game {
		throw new Error('Subclasses must override.');
	}

	public hydrate(
		_data: string,
		_socketManager: ServerSocketManager<any>,
		_saveGameDelegate: SaveGameDelegate,
	): Game {
		throw new Error('Subclasses must override.');
	}
}
