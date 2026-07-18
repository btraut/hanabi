import HanabiGameFactory from './games/hanabi/HanabiGameFactory.js';
import { GameManagerMessage } from '@hanabi/shared';
import GameManager from './games/server/GameManager.js';
import { GameStore } from './games/server/GameStore.js';
import LocalFileGameStore from './games/server/LocalFileGameStore.js';
import RedisGameStore from './games/server/RedisGameStore.js';
import { createApp } from './app.js';
import Logger from './utils/Logger.js';
import RedisClient from './utils/RedisClient.js';
import { env } from './env.js';
import express from 'express';
import path from 'path';
import * as url from 'url';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SHUTDOWN_TIMEOUT_MS = 10_000;

async function main(): Promise<void> {
	// Enable logs.
	Logger.init();

	const runtime = createApp<GameManagerMessage>({
		nodeEnv: env.NODE_ENV,
		sessionCookieSecret: env.SESSION_COOKIE_SECRET,
	});
	const { app, httpServer: server, socketManager } = runtime;
	let ready = false;
	app.set('port', env.PORT);

	// Optionally remove www from the domain name.
	if (env.REDIRECT_URL_PROTOCOL_AND_SUBDOMAIN) {
		app.use((req, res, next) => {
			if (req.headers.host!.match(/^www\..*/i)) {
				res.redirect(301, url.parse(env.DOMAIN_BASE + req.url).href);
				return;
			} else if (req.url.slice(-1) === '/' && req.url.length > 1) {
				res.redirect(301, url.parse(env.DOMAIN_BASE + req.url.slice(0, -1)).href);
				return;
			}

			next();
		});
	}

	server.on('error', (error) => {
		Logger.error('HTTP server error:', error);
	});
	app.get('/api/readyz', (_req, res) => {
		res.status(ready ? 200 : 503).json({ ready });
	});

	// In production, serve static files and render client
	// In development, Vite dev server handles the client
	if (env.NODE_ENV === 'production') {
		const webDistPath = path.resolve(__dirname, '../../../dist/apps/web');
		app.use(
			'/assets',
			express.static(path.join(webDistPath, 'assets'), {
				immutable: true,
				maxAge: '1y',
			}),
		);
		app.use(
			express.static(webDistPath, {
				index: false,
				setHeaders: (res) => res.setHeader('Cache-Control', 'no-cache'),
			}),
		);
		app.get('*', (_req, res) => {
			res.set('Cache-Control', 'no-cache');
			res.sendFile(path.join(webDistPath, 'index.html'));
		});
	} else {
		// In development, just return a message - Vite serves the client
		app.get('*', (_req, res) => {
			res.json({ message: 'Hanabi API Server - Use Vite dev server for client' });
		});
	}

	// Prune old socket connections.
	socketManager.prune();
	const socketPruneInterval = setInterval(() => socketManager.prune(), 1000 * 60);
	socketPruneInterval.unref();

	// Build a game store, whichever the server is configured to use.
	let gameStore: GameStore;
	if (env.GAME_STORE === 'redis') {
		// Connect to Redis.
		const redisClient = new RedisClient();
		await redisClient.connect(env.REDIS_URL);

		gameStore = new RedisGameStore(redisClient);
	} else {
		const savedGamesPath = path.resolve(__dirname, '../../../.saved-games');
		gameStore = new LocalFileGameStore(savedGamesPath);
	}

	// Start a game manager.
	const gameManager = new GameManager(socketManager, gameStore);

	// Add games.
	gameManager.addGameFactory(new HanabiGameFactory());

	// Restore existing games.
	await gameManager.restoreGames();

	// Prune old games.
	gameManager.prune();
	const gamePruneInterval = setInterval(() => gameManager.prune(), 1000 * 60);
	gamePruneInterval.unref();

	await runtime.listen(Number(env.PORT));
	ready = true;

	let shuttingDown = false;
	const shutdown = async () => {
		if (shuttingDown) return;
		shuttingDown = true;
		ready = false;
		Logger.info('Shutting down server.');
		const forcedShutdown = setTimeout(() => {
			Logger.error(`Shutdown exceeded ${SHUTDOWN_TIMEOUT_MS}ms; forcing process exit.`);
			process.exit(1);
		}, SHUTDOWN_TIMEOUT_MS);
		clearInterval(socketPruneInterval);
		clearInterval(gamePruneInterval);
		try {
			await runtime.close();
			await gameManager.close();
		} finally {
			clearTimeout(forcedShutdown);
		}
	};
	for (const signal of ['SIGTERM', 'SIGINT'] as const) {
		process.once(signal, () => {
			void shutdown().catch((error: unknown) => {
				Logger.error('There was an error shutting down the server.', error);
				process.exitCode = 1;
			});
		});
	}

	// URLs.
	const port = env.PORT;
	const localUrl = `http://localhost:${port}`;

	// Notify!
	Logger.info(`
———————————————————————————————————————————————————————————————————
 Hanabi Server
 ${localUrl}
 Listening for requests in ${env.NODE_ENV} mode.
———————————————————————————————————————————————————————————————————
`);
}

void main().catch((error: unknown) => {
	Logger.error('There was an error starting up the server.', error);
	process.exit(1);
});
