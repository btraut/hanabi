import * as React from 'react';
import * as bodyParser from 'body-parser';
import * as cookieParser from 'cookie-parser';
import * as compress from 'compression';
import * as dotenv from 'dotenv';
import * as express from 'express';
import * as fs from 'fs';
import * as http from 'http';
import * as logger from 'morgan';
import * as methodOverride from 'method-override';
import * as path from 'path';
import * as ReactDOMServer from 'react-dom/server';
import * as uuid from 'uuid';
import { StaticRouter, matchPath } from 'react-router';
import * as url from 'url';
import { createStore } from 'redux';
import { Provider as StoreProvider } from 'react-redux';
import 'cross-fetch/polyfill';

import routes from './routes';
import { StoreData, reducer, initialState } from './reducers/root';
import App from './components/App';
import Logger from './utils/Logger';
import ServerSocketManager from './utils/ServerSocketManager';
import ServerGameManager from './utils/ServerGameManager';

// Define globals from webpack.
declare const DOMAIN_BASE: string;
declare const PORT: string;
declare const ENV_PATH: string;
declare const PUBLIC_ASSETS_PATH: string;
declare const SERVER_VIEWS_PATH: string;

const SESSION_COOKIE_NAME = 'SESSION';

// Wrap remaining startup in an async function so we can use await.
(async () => {
	try {
		// Set up process exit handler.
		process.on('SIGTERM', () => {
			Logger.error(`Shutting down server.`);
			process.exit();
		});
		
		// Load environment variables from .env file.
		dotenv.config({ path: path.resolve(__dirname, ENV_PATH) });
		
		// Enable logs.
		Logger.init();
			
		// Load the webpack-assets manifest.
		const webpackAssets = fs.readFileSync(path.resolve(__dirname, '../../webpack-assets.json'), 'utf8');
		const webpackAssetsData = JSON.parse(webpackAssets);
		
		// Create Express server.
		const app = express();
		
		// Express Configuration
		app.enable('strict routing');
		app.enable('trust proxy');
		app.set('port', PORT);
		app.set('views', path.resolve(__dirname, SERVER_VIEWS_PATH));
		app.set('view engine', 'pug');
		app.use(compress());
		app.use(logger('dev'));
		app.use(bodyParser.json());
		app.use(bodyParser.urlencoded({ extended: true }));
		app.use(methodOverride());
		app.use(cookieParser(process.env.SESSION_COOKIE_SECRET!));
		app.use((_req, _res, next) => {
			app.locals.env = process.env;
			app.locals.clientScriptPath = webpackAssetsData.client.js;
			app.locals.clientStylesPath = webpackAssetsData.client.css;
			
			next();
		});
		
		// Optionally remove www from the domain name.
		if (process.env.REDIRECT_URL_PROTOCOL_AND_SUBDOMAIN) {
			app.use((req, res, next) => {
				if (req.headers.host.match(/^www\..*/i)) {
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
		app.use(express.static(path.resolve(__dirname, PUBLIC_ASSETS_PATH), { maxAge: 31557600000 }));
		
		// Handle cookies.
		app.use((req, res, next) => {
			// Check if the user has a cookie.
			const sessionCookie = req.cookies && req.cookies[SESSION_COOKIE_NAME];
			if (!sessionCookie) {
				res.cookie(SESSION_COOKIE_NAME, uuid(), { maxAge: 900000 });
			}
			
			next();
		});
		
		app.get('/api/auth-socket', async (req: express.Request, res: express.Response) => {
			if (!req.cookies || !req.cookies[SESSION_COOKIE_NAME]) {
				res.json({ error: 'Must enable cookies.' });
				return;
			}
			
			console.log('req.cookies[SESSION_COOKIE_NAME]: ' + req.cookies[SESSION_COOKIE_NAME]);
			
			const token = ServerSocketManager.addTokenForUser(req.cookies[SESSION_COOKIE_NAME]);
			res.json({ token });
		});
		
		// Render the client.
		app.get('*', async (req: express.Request, res: express.Response) => {
			// Create the redux store.
			const store = createStore<StoreData>(reducer, initialState);
			
			// Match url to path.
			const matchedRoute = routes.find(route => !!matchPath(req.url, { path: route.path, exact: true }));
			
			// Call custom populateStore method.
			if (matchedRoute && matchedRoute.component && matchedRoute.component.preload) {
				await matchedRoute.component.preload();
			}
			
			// Figure out the page title.
			let title = 'Lost in Translation';
			if (matchedRoute && matchedRoute.component && matchedRoute.component.title) {
				if (typeof matchedRoute.component.title === 'string') {
					title = matchedRoute.component.title;
				} else {
					title = await matchedRoute.component.title();
				}
			}
			
			// Initialize a context obj to pass-by-ref into StaticRouter. Unfortunately
			// there are no types for this.
			const context: any = {};
			
			// Render markup. Collect the list of modules we've used to render.
			const markup = ReactDOMServer.renderToString(
				<StoreProvider store={store}>
					<StaticRouter location={req.url} context={context}>
						<App routes={routes} />
					</StaticRouter>
				</StoreProvider>
			);
			
			// context.url will contain the URL to redirect to if a <Redirect> was used
			if (context.url) {
				res.writeHead(302, { Location: context.url });
				res.end();
				return;
			}
			
			// Create the response via pug view.
			return res.render('app', {
				title,
				content: markup,
				preloadedState: store.getState()
			});
		});
		
		// Start Express and socket.io servers.
		const server = http.createServer(app);

		ServerGameManager.connect();
		ServerSocketManager.connect(server);
		
		await (new Promise<express.Express>((resolve, reject) => {
			server.listen(app.get('port'), (error: any) => {
				if (error) {
					reject(error);
					return;
				}
				
				resolve();
			});
		}));
		
		// Notify!
		Logger.info(
			'' + '\n\n' +
			'———————————————————————————————————————————————————————————————————' + '\n' +
			' lost in translation' + '\n' +
			` http://localhost:${ app.get('port') }/` + '\n' +
			' ' + '\n' +
			` Listening for requests in ${ process.env.NODE_ENV } mode.` + '\n' +
			'———————————————————————————————————————————————————————————————————' + '\n' +
			''
		);
	} catch (error) {
		Logger.error('There was an error starting up the server.', [error, error.stack]);
		process.exit(1);
	}
})();
