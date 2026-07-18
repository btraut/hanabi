import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { HANABI_MIN_PLAYERS } from '@hanabi/shared';
import { env } from './env.js';
import { GameStore } from './games/server/GameStore.js';
import LocalFileGameStore from './games/server/LocalFileGameStore.js';
import RedisGameStore from './games/server/RedisGameStore.js';
import { createHanabiRuntime } from './runtime.js';
import Logger from './utils/Logger.js';
import RedisClient from './utils/RedisClient.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SHUTDOWN_TIMEOUT_MS = 10_000;

async function createGameStore(): Promise<GameStore> {
	if (env.GAME_STORE === 'redis') {
		const redisClient = new RedisClient();
		await redisClient.connect(env.REDIS_URL);
		return new RedisGameStore(redisClient);
	}
	return new LocalFileGameStore(path.resolve(__dirname, '../../../.saved-games'));
}

async function main(): Promise<void> {
	Logger.init();
	const gameStore = await createGameStore();
	const runtime = createHanabiRuntime({
		nodeEnv: env.NODE_ENV,
		sessionCookieSecret: env.SESSION_COOKIE_SECRET,
		gameStore,
		webDistPath: path.resolve(__dirname, '../../../dist/apps/web'),
		redirectUrlProtocolAndSubdomain: env.REDIRECT_URL_PROTOCOL_AND_SUBDOMAIN,
		domainBase: env.DOMAIN_BASE,
		minimumPlayers: env.NODE_ENV === 'development' ? 1 : HANABI_MIN_PLAYERS,
	});
	await runtime.start(Number(env.PORT));

	let shuttingDown = false;
	const shutdown = async () => {
		if (shuttingDown) return;
		shuttingDown = true;
		Logger.info('Shutting down server.');
		const forcedShutdown = setTimeout(() => {
			Logger.error(`Shutdown exceeded ${SHUTDOWN_TIMEOUT_MS}ms; forcing process exit.`);
			process.exit(1);
		}, SHUTDOWN_TIMEOUT_MS);
		try {
			await runtime.close();
		} finally {
			clearTimeout(forcedShutdown);
		}
	};
	for (const signal of ['SIGTERM', 'SIGINT'] as const) {
		process.once(signal, () => {
			void shutdown().catch((error: unknown) => {
				Logger.error('There was an error shutting down the server.', error);
				process.exit(1);
			});
		});
	}

	Logger.info(`
———————————————————————————————————————————————————————————————————
 Hanabi Server
 http://localhost:${env.PORT}
 Listening for requests in ${env.NODE_ENV} mode.
———————————————————————————————————————————————————————————————————
`);
}

void main().catch((error: unknown) => {
	Logger.error('There was an error starting up the server.', error);
	process.exit(1);
});
