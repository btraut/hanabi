import { describe, expect, it } from 'vitest';
import { parseEnv } from './env.js';

describe('parseEnv', () => {
	it('uses a local file store by default outside production', () => {
		expect(parseEnv({ NODE_ENV: 'development' })).toMatchObject({
			ADMIN_PASSWORD: 'tenfour',
			GAME_STORE: 'file',
			PORT: '3000',
		});
	});

	it('allows the lightweight admin password to be configured without a production minimum', () => {
		expect(
			parseEnv({
				NODE_ENV: 'production',
				GAME_STORE: 'redis',
				REDIS_URL: 'redis://localhost',
				DATABASE_URL: 'postgresql://localhost/hanabi',
				SESSION_COOKIE_SECRET: 'a'.repeat(32),
				ADMIN_PASSWORD: 'x',
			}),
		).toMatchObject({
			ADMIN_PASSWORD: 'x',
		});
	});

	it('requires an explicit durable production store', () => {
		expect(() =>
			parseEnv({
				NODE_ENV: 'production',
				SESSION_COOKIE_SECRET: 'a'.repeat(32),
			}),
		).toThrow('GAME_STORE must be explicitly configured');

		expect(() =>
			parseEnv({
				NODE_ENV: 'production',
				GAME_STORE: 'file',
				SESSION_COOKIE_SECRET: 'a'.repeat(32),
			}),
		).toThrow('GAME_STORE=file is ephemeral');
	});

	it('allows an explicitly acknowledged production file store', () => {
		expect(
			parseEnv({
				NODE_ENV: 'production',
				GAME_STORE: 'file',
				ALLOW_FILE_GAME_STORE: 'true',
				DATABASE_URL: 'postgresql://localhost/hanabi',
				SESSION_COOKIE_SECRET: 'a'.repeat(32),
			}),
		).toMatchObject({ GAME_STORE: 'file' });
	});

	it('requires a valid Postgres URL in production', () => {
		const production = {
			NODE_ENV: 'production',
			GAME_STORE: 'redis',
			REDIS_URL: 'redis://localhost',
			SESSION_COOKIE_SECRET: 'a'.repeat(32),
		};
		expect(() => parseEnv(production)).toThrow('DATABASE_URL must be configured');
		expect(() => parseEnv({ ...production, DATABASE_URL: 'redis://localhost' })).toThrow(
			'DATABASE_URL',
		);
		expect(
			parseEnv({ ...production, DATABASE_URL: 'postgresql://localhost/hanabi' }),
		).toMatchObject({ DATABASE_URL: 'postgresql://localhost/hanabi' });
		expect(parseEnv({ NODE_ENV: 'development' })).toMatchObject({ DATABASE_URL: '' });
	});

	it('requires a valid Redis URL when Redis is selected', () => {
		expect(() => parseEnv({ GAME_STORE: 'redis' })).toThrow('REDIS_URL');
		expect(() => parseEnv({ GAME_STORE: 'redis', REDIS_URL: 'https://example.com' })).toThrow(
			'REDIS_URL',
		);
		expect(
			parseEnv({ GAME_STORE: 'redis', REDIS_URL: 'rediss://redis.example.com' }),
		).toMatchObject({ GAME_STORE: 'redis' });
	});

	it('rejects weak production secrets and invalid store names', () => {
		expect(() =>
			parseEnv({
				NODE_ENV: 'production',
				GAME_STORE: 'redis',
				REDIS_URL: 'redis://localhost',
				DATABASE_URL: 'postgresql://localhost/hanabi',
				SESSION_COOKIE_SECRET: 'too-short',
			}),
		).toThrow('at least 32 characters');
		expect(() =>
			parseEnv({
				NODE_ENV: 'production',
				GAME_STORE: 'redis',
				REDIS_URL: 'redis://localhost',
				DATABASE_URL: 'postgresql://localhost/hanabi',
				SESSION_COOKIE_SECRET: 'replace-with-at-least-32-random-characters',
			}),
		).toThrow('documented placeholder');
		expect(() => parseEnv({ GAME_STORE: 'memory' })).toThrow('GAME_STORE');
	});

	it('only enables debug player controls in development', () => {
		expect(parseEnv({ NODE_ENV: 'development', DEBUG_PLAYER_CONTROLS: 'true' })).toMatchObject({
			DEBUG_PLAYER_CONTROLS: true,
		});
		expect(parseEnv({ NODE_ENV: 'test', DEBUG_PLAYER_CONTROLS: 'true' })).toMatchObject({
			DEBUG_PLAYER_CONTROLS: false,
		});
		expect(() =>
			parseEnv({
				NODE_ENV: 'production',
				GAME_STORE: 'redis',
				REDIS_URL: 'redis://localhost',
				DATABASE_URL: 'postgresql://localhost/hanabi',
				SESSION_COOKIE_SECRET: 'a'.repeat(32),
				DEBUG_PLAYER_CONTROLS: 'true',
			}),
		).toThrow('DEBUG_PLAYER_CONTROLS cannot be enabled in production.');
	});
});
