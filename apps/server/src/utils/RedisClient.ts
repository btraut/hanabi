import Logger from './Logger.js';
import { createClient, RedisClientType } from 'redis';

export default class RedisClient {
	private _client: RedisClientType | null = null;

	public async connect(url: string): Promise<void> {
		if (this._client) {
			return;
		}

		this._client = createClient({ url });

		this._client.on('connect', this._handleConnect);
		this._client.on('error', this._handleError);

		await this._client.connect();
	}

	public async disconnect(): Promise<void> {
		if (!this._client) return;

		this._client.off('error', this._handleError);
		this._client.off('connect', this._handleConnect);

		await this._client.quit();
	}

	public async get(key: string): Promise<string | null> {
		if (!this._client) throw new Error('Redis client not connected');
		return this._client.get(key);
	}

	public async set(key: string, value: string): Promise<void> {
		if (!this._client) throw new Error('Redis client not connected');
		await this._client.set(key, value);
	}

	public async del(key: string): Promise<void> {
		if (!this._client) throw new Error('Redis client not connected');
		await this._client.del(key);
	}

	private _handleConnect = () => {
		Logger.info('Connected to Redis');
	};

	private _handleError = (error: Error) => {
		Logger.error(error.message);
	};
}
