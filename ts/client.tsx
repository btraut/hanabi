import * as React from 'react';
import * as ReactDOM from 'react-dom';

import App from './components/App';
import ErrorController from './client-controllers/ErrorController';
import HistoryStateManager from './utils/HistoryStateManager';
import HomeController from './client-controllers/HomeController';
import 'isomorphic-fetch';
import Router from './stores/Router';

// Import styles. This forces webpack to include them in the build, but
// ExtractTextPlugin will strip them from the JS output.
import './../public/less/main.less';

// Public Routes
Router.addRoute('/', HomeController.getHome);

// 404 Route
Router.addRoute('*any', ErrorController.getError404);

// Enable the history state manager.
HistoryStateManager.subscribe();

// Navigate to the page based on url.
Router.navigateToPath(window.location.pathname + window.location.search, null, true);

// Start the app.
ReactDOM.render(
	<App />,
	document.getElementById('AppContainer')
);
