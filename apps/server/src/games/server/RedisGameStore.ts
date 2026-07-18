import Game from './Game.js';
import { GameStore } from './GameStore.js';
import Logger from '../../utils/Logger.js';
import RedisClient from '../../utils/RedisClient.js';

const LEGACY_GAME_LIST_KEY = 'gameData.__all__';
const GAME_INDEX_KEY = 'gameData.__index__';
const RESTORE_BATCH_SIZE = 500;

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
			await this._redisClient.saveGameRecord(
				scope,
				serialized,
				GAME_INDEX_KEY,
				scope,
				LEGACY_GAME_LIST_KEY,
				title,
				id,
			);
		});
	}

	public async deleteGame(game: Game): Promise<void> {
		const { title, id } = game;
		const scope = this._getScope(title, id);
		await this._enqueueMutation(async () => {
			await this._redisClient.deleteGameRecord(
				scope,
				GAME_INDEX_KEY,
				scope,
				LEGACY_GAME_LIST_KEY,
				title,
				id,
			);
		});
	}

	public async loadGameData(): Promise<{ [title: string]: string[] }> {
		await this._mutationQueue;
		const scopes = new Set(await this._redisClient.setMembers(GAME_INDEX_KEY));
		const legacyGameList = await this._getLegacyGameList();
		for (const [title, ids] of Object.entries(legacyGameList)) {
			for (const id of ids) scopes.add(this._getScope(title, id));
		}

		const indexedScopes = [...scopes].flatMap((scope) => {
			const match = /^gameData\.([^.]+)\.(.+)$/.exec(scope);
			return match ? [{ scope, title: match[1] }] : [];
		});
		const gameData: { [title: string]: string[] } = {};
		for (let index = 0; index < indexedScopes.length; index += RESTORE_BATCH_SIZE) {
			const batch = indexedScopes.slice(index, index + RESTORE_BATCH_SIZE);
			const records = await this._redisClient.getMany(batch.map(({ scope }) => scope));
			records.forEach((data, recordIndex) => {
				if (data) (gameData[batch[recordIndex].title] ??= []).push(data);
			});
		}

		return gameData;
	}

	private async _getLegacyGameList(): Promise<{ [title: string]: string[] }> {
		const listRaw = await this._redisClient.get(LEGACY_GAME_LIST_KEY);

		if (!listRaw) {
			return {};
		}

		return JSON.parse(listRaw) as { [title: string]: string[] };
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
