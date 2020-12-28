import 'cross-fetch/polyfill';
import 'normalize.css';
import '../less/main.less';

import { render } from 'react-dom';
import { BrowserRouter } from 'react-router-dom';

import App from './components/App';
import ClientSocketManagerController from './components/ClientSocketManagerController';
import routes from './routes';

// Grab the state from a global variable injected into the server-generated
// HTML and clean up window after.
// const preloadedState = (window as any).__PRELOADED_STATE__ as StoreData;
delete (window as any).__PRELOADED_STATE__;

// Start the app.
render(
	<BrowserRouter>
		<ClientSocketManagerController>
			<App routes={routes} />
		</ClientSocketManagerController>
	</BrowserRouter>,
	document.getElementById('AppContainer'),
);
