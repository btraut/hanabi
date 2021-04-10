import { HANABI_GAME_TITLE } from 'app/src/games/hanabi/HanabiGameData';
import { HanabiMessage } from 'app/src/games/hanabi/HanabiMessages';
import HanabiGame from 'app/src/games/hanabi/server/HanabiGame';
import GameFactory from 'app/src/games/server/GameFactory';
import { SaveGameDelegate } from 'app/src/games/server/GameStore';
import ServerSocketManager from 'app/src/utils/server/SocketManager';

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
