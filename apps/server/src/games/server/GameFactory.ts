import Game from './Game.js';
import { SaveGameDelegate } from './GameStore.js';
import ServerSocketManager from '../../utils/SocketManager.js';

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
