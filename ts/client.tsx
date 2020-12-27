import 'cross-fetch/polyfill';
// Import styles. This forces webpack to include them in the build, but
// ExtractTextPlugin will strip them from the JS output.
import 'normalize.css';
import './../public/less/main.less';

import * as React from 'react';
import { hydrate } from 'react-dom';
import { BrowserRouter } from 'react-router-dom';

import App from './components/App';
import routes from './routes';

// Grab the state from a global variable injected into the server-generated
// HTML and clean up window after.
// const preloadedState = (window as any).__PRELOADED_STATE__ as StoreData;
delete (window as any).__PRELOADED_STATE__;

// Start the app.
hydrate(
	<BrowserRouter>
		<App routes={routes} />
	</BrowserRouter>,
	document.getElementById('AppContainer'),
);
