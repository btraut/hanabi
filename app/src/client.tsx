import 'cross-fetch/polyfill';
import 'normalize.css';
import 'app/less/main.less';

import App from 'app/src/components/App';
import routes from 'app/src/routes';
import { render } from 'react-dom';
import { BrowserRouter } from 'react-router-dom';

// Grab the state from a global variable injected into the server-generated
// HTML and clean up window after.
// const preloadedState = (window as any).__PRELOADED_STATE__ as StoreData;
delete (window as any).__PRELOADED_STATE__;

// Start the app.
render(
	<BrowserRouter>
		<App routes={routes} />
	</BrowserRouter>,
	document.getElementById('app'),
);
