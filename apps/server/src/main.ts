import HanabiGameFactory from './games/hanabi/HanabiGameFactory.js';
import GameManager from './games/server/GameManager.js';
import { GameStore } from './games/server/GameStore.js';
import LocalFileGameStore from './games/server/LocalFileGameStore.js';
import RedisGameStore from './games/server/RedisGameStore.js';
import Logger from './utils/Logger.js';
import RedisClient from './utils/RedisClient.js';
import SocketManager from './utils/SocketManager.js';
import { env } from './env.js';
import compress from 'compression';
import cookieParser from 'cookie-parser';
import express from 'express';
import * as http from 'http';
import methodOverride from 'method-override';
import morgan from 'morgan';
import path from 'path';
import * as url from 'url';
import { v4 as uuidv4 } from 'uuid';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SESSION_COOKIE_NAME = 'SESSION';

// Wrap remaining startup in an async function so we can use await.
try {
	(async () => {
		// Set up process exit handler.
		process.on('SIGTERM', () => {
			Logger.error(`Shutting down server.`);
			process.exit();
		});

		// Enable logs.
		Logger.init();

		// Create Express server.
		const app = express();

		// Express Configuration
		app.enable('strict routing');
		app.enable('trust proxy');
		app.set('port', env.PORT);
		app.use(compress());
		app.use(morgan('dev'));
		app.use(express.json());
		app.use(express.urlencoded({ extended: true }));
		app.use(methodOverride());

		// Optionally remove www from the domain name.
		if (env.REDIRECT_URL_PROTOCOL_AND_SUBDOMAIN) {
			app.use((req, res, next) => {
				if (req.headers.host!.match(/^www\..*/i)) {
					res.redirect(301, url.parse(env.DOMAIN_BASE + req.url).href!);
					return;
				} else if (req.url.slice(-1) === '/' && req.url.length > 1) {
					res.redirect(301, url.parse(env.DOMAIN_BASE + req.url.slice(0, -1)).href!);
					return;
				}

				next();
			});
		}

		// Handle cookies.
		app.use(cookieParser(env.SESSION_COOKIE_SECRET));
		app.use((req, res, next) => {
			// Check if the user has a cookie.
			const sessionCookie = req.cookies && req.cookies[SESSION_COOKIE_NAME];
			if (!sessionCookie) {
				res.cookie(SESSION_COOKIE_NAME, uuidv4(), { expires: new Date(253402300000000) });
			}

			next();
		});

		// Create an http server for use in Express and socket.io.
		const server = http.createServer(app);
		server.on('error', (error) => {
			Logger.error('HTTP server error:', error);
		});

		// Start a socket manager.
		const socketManager = new SocketManager<any>(server);
		socketManager.start();

		app.get('/api/auth-socket', async (req: express.Request, res: express.Response) => {
			if (!req.cookies || !req.cookies[SESSION_COOKIE_NAME]) {
				res.json({ error: 'Must enable cookies.' });
				return;
			}

			const token = socketManager.addTokenForUser(req.cookies[SESSION_COOKIE_NAME]);
			res.json({ token });
		});

		// In production, serve static files and render client
		// In development, Vite dev server handles the client
		if (env.NODE_ENV === 'production') {
			const webDistPath = path.resolve(__dirname, '../../../dist/apps/web');
			app.use(express.static(webDistPath, { maxAge: 31557600000 }));
			app.get('*', (_req, res) => {
				res.sendFile(path.join(webDistPath, 'index.html'));
			});
		} else {
			// In development, just return a message - Vite serves the client
			app.get('*', (_req, res) => {
				res.json({ message: 'Hanabi API Server - Use Vite dev server for client' });
			});
		}

		server.listen(Number(env.PORT));

		// Prune old socket connections.
		socketManager.prune();
		setInterval(() => socketManager.prune(), 1000 * 60);

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
		setInterval(() => gameManager.prune(), 1000 * 60);

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
	})();
} catch (error) {
	Logger.error('There was an error starting up the server.', error);
	process.exit(1);
}
