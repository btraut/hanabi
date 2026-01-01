import { HANABI_GAME_TITLE, HanabiMessage } from '@hanabi/shared';
import HanabiGame from './HanabiGame.js';
import GameFactory from '../server/GameFactory.js';
import { SaveGameDelegate } from '../server/GameStore.js';
import ServerSocketManager from '../../utils/SocketManager.js';

export default class HanabiGameFactory extends GameFactory {
	public get title(): string {
		return HANABI_GAME_TITLE;
	}

	public create(
		creatorId: string,
		socketManager: ServerSocketManager<HanabiMessage>,
		saveGameDelegate: SaveGameDelegate,
	): HanabiGame {
		return new HanabiGame(creatorId, socketManager, saveGameDelegate);
	}

	public hydrate(
		data: string,
		socketManager: ServerSocketManager<HanabiMessage>,
		saveGameDelegate: SaveGameDelegate,
	): HanabiGame {
		return new HanabiGame(JSON.parse(data), socketManager, saveGameDelegate);
	}
}
