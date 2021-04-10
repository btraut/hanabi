import Game from 'app/src/games/server/Game';
import { GameStore } from 'app/src/games/server/GameStore';
import Logger from 'app/src/utils/server/Logger';
import RedisClient from 'app/src/utils/server/RedisClient';

const GAME_LIST_KEY = 'gameData.__all__';

export default class RedisGameStore implements GameStore {
	private _redisClient: RedisClient;

	constructor(redisClient: RedisClient) {
		this._redisClient = redisClient;
	}

	public async saveGame(game: Game): Promise<void> {
		const { title, id } = game;
		const scope = this._getScope(title, id);
		const serialized = game.serialize();

		if (!serialized) {
			return;
		}

		Logger.info(`Saving game: ${scope}`);
		await this._redisClient.set(scope, serialized);

		Logger.info(`Updating game list`);
		const gameList = await this._getGameList();
		let titleList = gameList[title] || [];
		if (!titleList.find((i) => i === id)) {
			titleList = [...titleList, id];
		}
		await this._setGameList({
			...gameList,
			[title]: titleList,
		});
	}

	public async deleteGame(game: Game): Promise<void> {
		// Delete the game data.
		const { title, id } = game;
		const scope = this._getScope(title, id);
		await this._redisClient.del(scope);

		// Delete the game from the list.
		const gameList = await this._getGameList();
		await this._setGameList({
			...gameList,
			[title]: (gameList[title] || []).filter((i) => i !== id),
		});
	}

	public async loadGameData(): Promise<{ [title: string]: string[] }> {
		// Fetch the list of games. This is in the form of { [title]:
		// Array<game-id> }. We'll need to turn this into { [title]:
		// Array<game-data> }
		const gameList = await this._getGameList();

		const gameData: { [title: string]: string[] } = {};

		// We want to kick off a bunch of reads all at the same time, so we'll
		// keep track of all promises.
		const promises: Promise<void>[] = [];

		// For each game id, we need to fetch the game data.
		for (const title of Object.keys(gameList)) {
			gameData[title] = [];

			for (const id of gameList[title]) {
				promises.push(
					this._redisClient.get(this._getScope(title, id)).then(
						(data) => {
							if (data) {
								gameData[title].push(data);
							}
						},
						(error) => {
							throw error;
						},
					),
				);
			}
		}

		// Wait for all games to load.
		await Promise.all(promises);

		return gameData;
	}

	private async _getGameList(): Promise<{ [title: string]: string[] }> {
		const listRaw = await this._redisClient.get(GAME_LIST_KEY);

		if (!listRaw) {
			return {};
		}

		return JSON.parse(listRaw);
	}

	private async _setGameList(gameList: { [title: string]: string[] }): Promise<void> {
		await this._redisClient.set(GAME_LIST_KEY, JSON.stringify(gameList));
	}

	private _getScope(title: string, id: string) {
		return `gameData.${title}.${id}`;
	}
}
