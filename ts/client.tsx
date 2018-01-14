import * as React from 'react';
import { hydrate } from 'react-dom';
import { BrowserRouter } from 'react-router-dom';
import 'cross-fetch/polyfill';

import App from './components/App';

// Import styles. This forces webpack to include them in the build, but
// ExtractTextPlugin will strip them from the JS output.
import './../public/less/main.less';

// Start the app.
hydrate(
	<BrowserRouter>
		<App />
	</BrowserRouter>,
	document.getElementById('AppContainer')
);
