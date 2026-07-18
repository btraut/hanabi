import Logger from './Logger.js';
import { createClient, RedisClientType } from 'redis';

const REDIS_CONNECT_TIMEOUT_MS = 10_000;
const REDIS_MAX_RECONNECT_ATTEMPTS = 5;
const SAVE_GAME_SCRIPT = `
redis.call('SET', KEYS[1], ARGV[1])
local added = redis.call('SADD', KEYS[2], ARGV[2])
if added == 1 then
  local legacy = {}
  local raw = redis.call('GET', KEYS[3])
  if raw then
    local ok, decoded = pcall(cjson.decode, raw)
    if ok and type(decoded) == 'table' then legacy = decoded end
  end
  local ids = legacy[ARGV[3]] or {}
  local present = false
  for _, id in ipairs(ids) do
    if id == ARGV[4] then present = true break end
  end
  if not present then table.insert(ids, ARGV[4]) end
  legacy[ARGV[3]] = ids
  redis.call('SET', KEYS[3], cjson.encode(legacy))
end
return 1
`;
const DELETE_GAME_SCRIPT = `
redis.call('DEL', KEYS[1])
redis.call('SREM', KEYS[2], ARGV[1])
local raw = redis.call('GET', KEYS[3])
if raw then
  local ok, legacy = pcall(cjson.decode, raw)
  if ok and type(legacy) == 'table' then
    local ids = legacy[ARGV[2]] or {}
    local retained = {}
    for _, id in ipairs(ids) do
      if id ~= ARGV[3] then table.insert(retained, id) end
    end
    if #retained > 0 then legacy[ARGV[2]] = retained else legacy[ARGV[2]] = nil end
    redis.call('SET', KEYS[3], cjson.encode(legacy))
  end
end
return 1
`;

export default class RedisClient {
	private _client: RedisClientType | null = null;

	public async connect(url: string): Promise<void> {
		if (this._client) {
			return;
		}

		this._client = createClient({
			url,
			socket: {
				connectTimeout: REDIS_CONNECT_TIMEOUT_MS,
				reconnectStrategy: (retries) =>
					retries >= REDIS_MAX_RECONNECT_ATTEMPTS
						? new Error('Redis reconnect limit reached.')
						: Math.min(100 * 2 ** retries, 2_000),
			},
		});

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

	public async getMany(keys: string[]): Promise<Array<string | null>> {
		if (!this._client) throw new Error('Redis client not connected');
		if (keys.length === 0) return [];
		return this._client.mGet(keys);
	}

	public async set(key: string, value: string): Promise<void> {
		if (!this._client) throw new Error('Redis client not connected');
		await this._client.set(key, value);
	}

	public async del(key: string): Promise<void> {
		if (!this._client) throw new Error('Redis client not connected');
		await this._client.del(key);
	}

	public async saveGameRecord(
		key: string,
		value: string,
		setKey: string,
		setMember: string,
		legacyKey: string,
		title: string,
		id: string,
	): Promise<void> {
		if (!this._client) throw new Error('Redis client not connected');
		await this._client.eval(SAVE_GAME_SCRIPT, {
			keys: [key, setKey, legacyKey],
			arguments: [value, setMember, title, id],
		});
	}

	public async deleteGameRecord(
		key: string,
		setKey: string,
		setMember: string,
		legacyKey: string,
		title: string,
		id: string,
	): Promise<void> {
		if (!this._client) throw new Error('Redis client not connected');
		await this._client.eval(DELETE_GAME_SCRIPT, {
			keys: [key, setKey, legacyKey],
			arguments: [setMember, title, id],
		});
	}

	public async setMembers(key: string): Promise<string[]> {
		if (!this._client) throw new Error('Redis client not connected');
		return this._client.sMembers(key);
	}

	private _handleConnect = () => {
		Logger.info('Connected to Redis');
	};

	private _handleError = (error: Error) => {
		Logger.error(error.message);
	};
}
