import * as dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
	assertValidProductionSessionSecret,
	DEVELOPMENT_SESSION_COOKIE_SECRET,
} from './sessionSecret.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env from app root or repo root.
dotenv.config({ path: path.resolve(__dirname, '../.env'), quiet: true });
dotenv.config({ path: path.resolve(__dirname, '../../../.env'), quiet: true });

export type GameStoreType = 'file' | 'redis';

export interface RuntimeEnv {
	NODE_ENV: 'development' | 'test' | 'production';
	PORT: string;
	SESSION_COOKIE_SECRET: string;
	GAME_STORE: GameStoreType;
	REDIS_URL: string;
	REDIRECT_URL_PROTOCOL_AND_SUBDOMAIN: string;
	DOMAIN_BASE: string;
	DEBUG_PLAYER_CONTROLS: boolean;
}

export function parseEnv(source: NodeJS.ProcessEnv): RuntimeEnv {
	const nodeEnv = source.NODE_ENV || 'development';
	if (!['development', 'test', 'production'].includes(nodeEnv)) {
		throw new Error(`NODE_ENV must be development, test, or production; received "${nodeEnv}".`);
	}

	const port = source.PORT || '3000';
	const parsedPort = Number(port);
	if (!Number.isInteger(parsedPort) || parsedPort < 0 || parsedPort > 65_535) {
		throw new Error(`PORT must be an integer between 0 and 65535; received "${port}".`);
	}

	const configuredGameStore = source.GAME_STORE;
	if (nodeEnv === 'production' && !configuredGameStore) {
		throw new Error('GAME_STORE must be explicitly configured in production.');
	}
	const gameStore = configuredGameStore || 'file';
	if (gameStore !== 'file' && gameStore !== 'redis') {
		throw new Error(`GAME_STORE must be "file" or "redis"; received "${gameStore}".`);
	}
	if (nodeEnv === 'production' && gameStore === 'file' && source.ALLOW_FILE_GAME_STORE !== 'true') {
		throw new Error(
			'GAME_STORE=file is ephemeral in production; set ALLOW_FILE_GAME_STORE=true only for an intentional single-process deployment.',
		);
	}

	const redisUrl = source.REDIS_URL || '';
	if (gameStore === 'redis') {
		let parsedRedisUrl: URL;
		try {
			parsedRedisUrl = new URL(redisUrl);
		} catch {
			throw new Error('REDIS_URL must be a valid redis:// or rediss:// URL when GAME_STORE=redis.');
		}
		if (!['redis:', 'rediss:'].includes(parsedRedisUrl.protocol)) {
			throw new Error('REDIS_URL must be a valid redis:// or rediss:// URL when GAME_STORE=redis.');
		}
	}

	const sessionCookieSecret = source.SESSION_COOKIE_SECRET || DEVELOPMENT_SESSION_COOKIE_SECRET;
	assertValidProductionSessionSecret(nodeEnv, sessionCookieSecret);
	const debugPlayerControlsRequested = source.DEBUG_PLAYER_CONTROLS === 'true';
	if (nodeEnv === 'production' && debugPlayerControlsRequested) {
		throw new Error('DEBUG_PLAYER_CONTROLS cannot be enabled in production.');
	}

	return {
		NODE_ENV: nodeEnv as RuntimeEnv['NODE_ENV'],
		PORT: port,
		SESSION_COOKIE_SECRET: sessionCookieSecret,
		GAME_STORE: gameStore,
		REDIS_URL: redisUrl,
		REDIRECT_URL_PROTOCOL_AND_SUBDOMAIN: source.REDIRECT_URL_PROTOCOL_AND_SUBDOMAIN || '',
		DOMAIN_BASE: source.DOMAIN_BASE || 'http://localhost:3000',
		DEBUG_PLAYER_CONTROLS: nodeEnv === 'development' && debugPlayerControlsRequested,
	};
}

export const env = parseEnv(process.env);
