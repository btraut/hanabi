import 'cross-fetch/polyfill';

import HanabiGameFactory from 'app/src/games/hanabi/server/HanabiGameFactory';
import GameManager from 'app/src/games/server/GameManager';
// import routes from 'app/src/routes';
import Logger from 'app/src/utils/server/Logger';
import SocketManager from 'app/src/utils/server/SocketManager';
import * as bodyParser from 'body-parser';
import compress from 'compression';
import cookieParser from 'cookie-parser';
import * as dotenv from 'dotenv';
import * as ejs from 'ejs';
import express from 'express';
import * as http from 'http';
import methodOverride from 'method-override';
import morgan from 'morgan';
// import { matchPath } from 'react-router';
import * as url from 'url';
import { v1 as uuidv1 } from 'uuid';

// Define globals from webpack.
declare const DOMAIN_BASE: string;
declare const ENV_PATH: string;
declare const PUBLIC_ASSETS_PATH: string;
declare const VIEWS_PATH: string;

const SESSION_COOKIE_NAME = 'SESSION';

// Wrap remaining startup in an async function so we can use await.
try {
	(async () => {
		// Set up process exit handler.
		process.on('SIGTERM', () => {
			Logger.error(`Shutting down server.`);
			process.exit();
		});

		// Load environment variables from .env file.
		dotenv.config({ path: ENV_PATH });

		// Enable logs.
		Logger.init();

		// Create Express server.
		const app = express();

		// Express Configuration
		app.enable('strict routing');
		app.enable('trust proxy');
		app.set('port', process.env.PORT || 3000);
		app.set('views', VIEWS_PATH);
		app.engine('html', ejs.renderFile);
		app.set('view engine', 'html');
		app.use(compress());
		app.use(morgan('dev'));
		app.use(bodyParser.json());
		app.use(bodyParser.urlencoded({ extended: true }));
		app.use(methodOverride());

		// Optionally remove www from the domain name.
		if (process.env.REDIRECT_URL_PROTOCOL_AND_SUBDOMAIN) {
			app.use((req, res, next) => {
				if (req.headers.host!.match(/^www\..*/i)) {
					res.redirect(301, url.parse(DOMAIN_BASE + req.url).href!);
					return;
				} else if (req.url.substr(-1) === '/' && req.url.length > 1) {
					res.redirect(301, url.parse(DOMAIN_BASE + req.url.slice(0, -1)).href!);
					return;
				}

				next();
			});
		}

		// Handle statics.
		app.use(express.static(PUBLIC_ASSETS_PATH, { maxAge: 31557600000 }));

		// Handle cookies.
		app.use(cookieParser(process.env.SESSION_COOKIE_SECRET!));
		app.use((req, res, next) => {
			// Check if the user has a cookie.
			const sessionCookie = req.cookies && req.cookies[SESSION_COOKIE_NAME];
			if (!sessionCookie) {
				res.cookie(SESSION_COOKIE_NAME, uuidv1(), { maxAge: 900000 });
			}

			next();
		});

		app.get('/api/auth-socket', async (req: express.Request, res: express.Response) => {
			if (!req.cookies || !req.cookies[SESSION_COOKIE_NAME]) {
				res.json({ error: 'Must enable cookies.' });
				return;
			}

			const token = socketManager.addTokenForUser(req.cookies[SESSION_COOKIE_NAME]);
			res.json({ token });
		});

		// Render the client.
		app.get('*', async (_req: express.Request, res: express.Response) => {
			// Match url to path.
			// const matchedRoute = routes.find(
			// 	(route) => !!matchPath(req.url, { path: route.path, exact: true }),
			// );

			// Call custom preload method.
			// if (matchedRoute && matchedRoute.component && matchedRoute.component.preload) {
			// 	await matchedRoute.component.preload();
			// }

			// Figure out the page title.
			// let title = 'Ten Four Games';
			// if (matchedRoute && matchedRoute.component && matchedRoute.component.title) {
			// 	title =
			// 		typeof matchedRoute.component.title === 'string'
			// 			? matchedRoute.component.title
			// 			: await matchedRoute.component.title();
			// }

			// Initialize a context obj to pass-by-ref into StaticRouter. Unfortunately
			// there are no types for this.
			// const context: any = {};

			// Render markup. Collect the list of modules we've used to render.
			// const markup = ReactDOMServer.renderToString(
			// 	<StaticRouter location={req.url} context={context}>
			// 		<App routes={routes} />
			// 	</StaticRouter>,
			// );

			// context.url will contain the URL to redirect to if a <Redirect> was used
			// if (context.url) {
			// 	res.writeHead(302, { Location: context.url });
			// 	res.end();
			// 	return;
			// }

			// Create the response via pug view.
			return res.render('index.html', {
				title: 'Ten Four Games', // title,
				content: '', // markup,
				preloadedState: {}, // store.getState(),
			});
		});

		// Create an http server for use in Express and socket.io.
		const server = http.createServer(app);
		server.on('error', (error) => {
			Logger.error('HTTP server error:', error);
		});
		server.listen(app.get('port'));

		// Start a socket manager.
		const socketManager = new SocketManager<any>(server);
		setInterval(() => socketManager.prune(), 1000 * 60);
		socketManager.start();

		// Start a game manager.
		const gameManager = new GameManager(socketManager);
		setInterval(() => gameManager.prune(), 1000 * 60 * 10);

		// Add games.
		// gameManager.addGameFactory(EscapeGame.title, EscapeGame.factory);
		gameManager.addGameFactory(new HanabiGameFactory());

		// Restore existing games.
		await gameManager.restoreGames();

		// Notify!
		Logger.info(
			'' +
				'\n\n' +
				'———————————————————————————————————————————————————————————————————' +
				'\n' +
				' Ten Four Games' +
				'\n' +
				` http://localhost:${app.get('port')}/` +
				'\n' +
				' ' +
				'\n' +
				` Listening for requests in ${process.env.NODE_ENV} mode.` +
				'\n' +
				'———————————————————————————————————————————————————————————————————' +
				'\n' +
				'',
		);
	})();
} catch (error) {
	Logger.error('There was an error starting up the server.', [error, error.stack]);
	process.exit(1);
}
