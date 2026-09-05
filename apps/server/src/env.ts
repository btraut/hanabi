import * as dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
	DEFAULT_BOT_MODEL,
	DEFAULT_BOT_REASONING_EFFORT,
	isBotReasoningEffort,
	type BotReasoningEffort,
} from './games/hanabi/bots/BotPolicy.js';
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
	DATABASE_URL: string;
	ADMIN_PASSWORD: string;
	REDIRECT_URL_PROTOCOL_AND_SUBDOMAIN: string;
	DOMAIN_BASE: string;
	DEBUG_PLAYER_CONTROLS: boolean;
	HANABI_BOTS_ENABLED: boolean;
	OPENAI_API_KEY: string;
	HANABI_BOT_MODEL: string;
	HANABI_BOT_REASONING_EFFORT: BotReasoningEffort;
	HANABI_BOT_TIMEOUT_MS: number;
	HANABI_BOT_MAX_OUTPUT_TOKENS: number;
	HANABI_BOT_MAX_CONCURRENT: number;
	HANABI_BOT_ROUND_MAX_ATTEMPTS: number;
	HANABI_BOT_ROUND_MAX_TOKENS: number;
	HANABI_BOT_GLOBAL_WINDOW_MS: number;
	HANABI_BOT_GLOBAL_MAX_ATTEMPTS: number;
	HANABI_BOT_GLOBAL_MAX_TOKENS: number;
}

function boundedInteger(
	source: NodeJS.ProcessEnv,
	name: string,
	fallback: number,
	minimum: number,
	maximum: number,
): number {
	const value = source[name] === undefined ? fallback : Number(source[name]);
	if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
		throw new Error(`${name} must be an integer between ${minimum} and ${maximum}.`);
	}
	return value;
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

	const databaseUrl = source.DATABASE_URL || '';
	if (nodeEnv === 'production' && !databaseUrl) {
		throw new Error('DATABASE_URL must be configured in production.');
	}
	if (databaseUrl) {
		let parsedDatabaseUrl: URL;
		try {
			parsedDatabaseUrl = new URL(databaseUrl);
		} catch {
			throw new Error('DATABASE_URL must be a valid postgres:// or postgresql:// URL.');
		}
		if (!['postgres:', 'postgresql:'].includes(parsedDatabaseUrl.protocol)) {
			throw new Error('DATABASE_URL must be a valid postgres:// or postgresql:// URL.');
		}
	}

	const sessionCookieSecret = source.SESSION_COOKIE_SECRET || DEVELOPMENT_SESSION_COOKIE_SECRET;
	assertValidProductionSessionSecret(nodeEnv, sessionCookieSecret);
	const debugPlayerControlsRequested = source.DEBUG_PLAYER_CONTROLS === 'true';
	if (nodeEnv === 'production' && debugPlayerControlsRequested) {
		throw new Error('DEBUG_PLAYER_CONTROLS cannot be enabled in production.');
	}
	if (
		source.HANABI_BOTS_ENABLED !== undefined &&
		!['true', 'false'].includes(source.HANABI_BOTS_ENABLED)
	) {
		throw new Error('HANABI_BOTS_ENABLED must be true or false.');
	}
	const botModel = source.HANABI_BOT_MODEL ?? DEFAULT_BOT_MODEL;
	if (!botModel.trim() || botModel.length > 256) {
		throw new Error('HANABI_BOT_MODEL must be a nonempty model ID of at most 256 characters.');
	}
	const botReasoningEffort = source.HANABI_BOT_REASONING_EFFORT ?? DEFAULT_BOT_REASONING_EFFORT;
	if (!isBotReasoningEffort(botReasoningEffort)) {
		throw new Error(
			'HANABI_BOT_REASONING_EFFORT must be none, minimal, low, medium, high, xhigh, or max.',
		);
	}
	if (botModel.startsWith('gpt-6-astra') && ['none', 'minimal'].includes(botReasoningEffort)) {
		throw new Error('HANABI_BOT_REASONING_EFFORT must be at least low for GPT-6 Astra.');
	}

	return {
		NODE_ENV: nodeEnv as RuntimeEnv['NODE_ENV'],
		PORT: port,
		SESSION_COOKIE_SECRET: sessionCookieSecret,
		GAME_STORE: gameStore,
		REDIS_URL: redisUrl,
		DATABASE_URL: databaseUrl,
		ADMIN_PASSWORD: source.ADMIN_PASSWORD || 'tenfour',
		REDIRECT_URL_PROTOCOL_AND_SUBDOMAIN: source.REDIRECT_URL_PROTOCOL_AND_SUBDOMAIN || '',
		DOMAIN_BASE: source.DOMAIN_BASE || 'http://localhost:3000',
		DEBUG_PLAYER_CONTROLS: nodeEnv === 'development' && debugPlayerControlsRequested,
		HANABI_BOTS_ENABLED: source.HANABI_BOTS_ENABLED === 'true',
		OPENAI_API_KEY: source.OPENAI_API_KEY || '',
		HANABI_BOT_MODEL: botModel,
		HANABI_BOT_REASONING_EFFORT: botReasoningEffort,
		HANABI_BOT_TIMEOUT_MS: boundedInteger(source, 'HANABI_BOT_TIMEOUT_MS', 120_000, 1_000, 120_000),
		HANABI_BOT_MAX_OUTPUT_TOKENS: boundedInteger(
			source,
			'HANABI_BOT_MAX_OUTPUT_TOKENS',
			16_384,
			32,
			16_384,
		),
		HANABI_BOT_MAX_CONCURRENT: boundedInteger(source, 'HANABI_BOT_MAX_CONCURRENT', 3, 1, 20),
		HANABI_BOT_ROUND_MAX_ATTEMPTS: boundedInteger(
			source,
			'HANABI_BOT_ROUND_MAX_ATTEMPTS',
			200,
			1,
			10_000,
		),
		HANABI_BOT_ROUND_MAX_TOKENS: boundedInteger(
			source,
			'HANABI_BOT_ROUND_MAX_TOKENS',
			2_000_000,
			1,
			100_000_000,
		),
		HANABI_BOT_GLOBAL_WINDOW_MS: boundedInteger(
			source,
			'HANABI_BOT_GLOBAL_WINDOW_MS',
			3_600_000,
			1_000,
			86_400_000,
		),
		HANABI_BOT_GLOBAL_MAX_ATTEMPTS: boundedInteger(
			source,
			'HANABI_BOT_GLOBAL_MAX_ATTEMPTS',
			500,
			1,
			100_000,
		),
		HANABI_BOT_GLOBAL_MAX_TOKENS: boundedInteger(
			source,
			'HANABI_BOT_GLOBAL_MAX_TOKENS',
			5_000_000,
			1,
			1_000_000_000,
		),
	};
}

export const env = parseEnv(process.env);
