import Game from './Game.js';
import { GameStore } from './GameStore.js';
import Logger from '../../utils/Logger.js';
import RedisClient from '../../utils/RedisClient.js';

const GAME_LIST_KEY = 'gameData.__all__';

export default class RedisGameStore implements GameStore {
	private _redisClient: RedisClient;
	private _mutationQueue: Promise<void> = Promise.resolve();

	constructor(redisClient: RedisClient) {
		this._redisClient = redisClient;
	}

	public async close(): Promise<void> {
		await this._mutationQueue;
		await this._redisClient.disconnect();
	}

	public async saveGame(game: Game): Promise<void> {
		const { title, id } = game;
		const scope = this._getScope(title, id);
		const serialized = game.serialize();

		if (!serialized) {
			return;
		}

		await this._enqueueMutation(async () => {
			Logger.info(`Saving game: ${scope}`);
			await this._redisClient.set(scope, serialized);

			Logger.info(`Updating game list`);
			const gameList = await this._getGameList();
			let titleList = gameList[title] || [];
			if (!titleList.includes(id)) {
				titleList = [...titleList, id];
			}
			await this._setGameList({
				...gameList,
				[title]: titleList,
			});
		});
	}

	public async deleteGame(game: Game): Promise<void> {
		const { title, id } = game;
		const scope = this._getScope(title, id);
		await this._enqueueMutation(async () => {
			await this._redisClient.del(scope);

			const gameList = await this._getGameList();
			await this._setGameList({
				...gameList,
				[title]: (gameList[title] || []).filter((i) => i !== id),
			});
		});
	}

	public async loadGameData(): Promise<{ [title: string]: string[] }> {
		await this._mutationQueue;
		const gameList = await this._getGameList();

		const gameData: { [title: string]: string[] } = {};

		const promises: Promise<void>[] = [];

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

		await Promise.all(promises);

		return gameData;
	}

	private async _getGameList(): Promise<{ [title: string]: string[] }> {
		const listRaw = await this._redisClient.get(GAME_LIST_KEY);

		if (!listRaw) {
			return {};
		}

		return JSON.parse(listRaw) as { [title: string]: string[] };
	}

	private async _setGameList(gameList: { [title: string]: string[] }): Promise<void> {
		await this._redisClient.set(GAME_LIST_KEY, JSON.stringify(gameList));
	}

	private _enqueueMutation(operation: () => Promise<void>): Promise<void> {
		const result = this._mutationQueue.then(operation);
		this._mutationQueue = result.catch(() => undefined);
		return result;
	}

	private _getScope(title: string, id: string) {
		return `gameData.${title}.${id}`;
	}
}
