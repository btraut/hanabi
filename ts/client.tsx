import * as React from 'react';
import { hydrate } from 'react-dom';
import { BrowserRouter } from 'react-router-dom';
import { createStore } from 'redux';
import { Provider as StoreProvider } from 'react-redux';
import 'cross-fetch/polyfill';

import { StoreData, reducer } from './reducers/root';
import routes from './routes';
import App from './components/App';
import ScrollRestoration from './components/ScrollRestoration';

// Import styles. This forces webpack to include them in the build, but
// ExtractTextPlugin will strip them from the JS output.
import './../public/less/main.less';

// Grab the state from a global variable injected into the server-generated
// HTML and clean up window after.
const preloadedState = (window as any).__PRELOADED_STATE__ as StoreData;
delete (window as any).__PRELOADED_STATE__;

// Create Redux store with initial state.
const store = createStore<StoreData>(reducer, preloadedState);

// Start the app.
hydrate(
	<StoreProvider store={store}>
		<BrowserRouter>
			<ScrollRestoration>
				<App routes={routes} />
			</ScrollRestoration>
		</BrowserRouter>
	</StoreProvider>,
	document.getElementById('AppContainer')
);
