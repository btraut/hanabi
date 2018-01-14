import * as React from 'react';
import * as bodyParser from 'body-parser';
import * as cookieParser from 'cookie-parser';
import * as compress from 'compression';
import * as dotenv from 'dotenv';
import * as express from 'express';
import * as fs from 'fs';
import * as logger from 'morgan';
import * as methodOverride from 'method-override';
import * as path from 'path';
import * as ReactDOMServer from 'react-dom/server';
import { StaticRouter, matchPath } from 'react-router';
import * as url from 'url';
import { createStore, applyMiddleware } from 'redux';
import { Provider as StoreProvider } from 'react-redux';
import thunk from 'redux-thunk';
import 'cross-fetch/polyfill';

import routes from './routes';
import { StoreData } from './reducers/root';
import { reducer } from './reducers/root';
import App from './components/App';
import Logger from './utils/Logger';

// Define globals from webpack.
declare const DOMAIN_BASE: string;
declare const ENV_PATH: string;
declare const PUBLIC_ASSETS_PATH: string;
declare const SERVER_VIEWS_PATH: string;

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
		app.set('port', process.env.PORT || 3000);
		app.set('views', path.resolve(__dirname, SERVER_VIEWS_PATH));
		app.set('view engine', 'pug');
		app.use(compress());
		app.use(logger('dev'));
		
		if (process.env.REDIRECT_URL_PROTOCOL_AND_SUBDOMAIN) {
			app.all(/.*/, (req, res, next) => {
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
		
		app.use(bodyParser.json());
		app.use(bodyParser.urlencoded({ extended: true }));
		app.use(methodOverride());
		app.use(cookieParser());
		app.use((_req, _res, next) => {
			app.locals.env = process.env;
			app.locals.clientScriptPath = webpackAssetsData.client.js;
			app.locals.clientStylesPath = webpackAssetsData.client.css;
			
			next();
		});
		app.use(express.static(path.resolve(__dirname, PUBLIC_ASSETS_PATH), { maxAge: 31557600000 }));
		
		// Render the client.
		app.get('*', async (req: express.Request, res: express.Response) => {
			const context = {};

			// Create the redux store.
			const store = createStore<StoreData>(reducer, applyMiddleware(thunk));

			// Match url to path.
			const matchedRoute = routes.find(route => !!matchPath(req.url, { path: route.path, exact: true }));

			// Call custom populateStore method.
			if (matchedRoute && matchedRoute.preload) {
				await matchedRoute.preload(store);
			}

			// Render markup.
			const markup = ReactDOMServer.renderToString(
				<StoreProvider store={store}>
					<StaticRouter location={req.url} context={context}>
						<App />
					</StaticRouter>
				</StoreProvider>
			);
			
			// Create the response via pug view.
			return res.render('app', {
				title: matchedRoute && matchedRoute.title || 'Lost in Translation',
				content: markup,
				preloadedState: store
			});
		});
		
		// Start Express server.
		await (new Promise<express.Express>((resolve, reject) => {
			app.listen(app.get('port'), (error: any) => {
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
