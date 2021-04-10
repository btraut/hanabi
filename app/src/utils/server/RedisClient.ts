import Logger from 'app/src/utils/server/Logger';
import redis from 'redis';
import { promisify } from 'util';

export default class RedisClient {
	private _client: redis.RedisClient;

	private _getAsync: (key: string) => Promise<string | null>;
	private _setAsync: (key: string, value: string) => Promise<void>;
	private _delAsync: (key: string) => Promise<void>;
	private _quitAsync: () => Promise<void>;

	public connect(url: string): void {
		if (this._client) {
			return;
		}

		this._client = redis.createClient({ url });

		this._client.on('connect', this._handleConnect);
		this._client.on('error', this._handleError);

		this._getAsync = promisify(this._client.get).bind(this._client);
		this._setAsync = promisify(this._client.set).bind(this._client);
		this._delAsync = promisify(this._client.del).bind(this._client);
		this._quitAsync = promisify(this._client.quit).bind(this._client);
	}

	public async disconnect(): Promise<void> {
		this._client.off('error', this._handleError);
		this._client.off('connect', this._handleConnect);

		return this._quitAsync();
	}

	public async get(key: string): Promise<string | null> {
		return this._getAsync(key);
	}

	public async set(key: string, value: string): Promise<void> {
		return this._setAsync(key, value);
	}

	public async del(key: string): Promise<void> {
		return this._delAsync(key);
	}

	private _handleConnect = () => {
		Logger.info('Connected to Redis');
	};

	private _handleError = (error: string) => {
		Logger.error(error);
	};
}
