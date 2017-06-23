import * as React from 'react';
import * as ReactDOM from 'react-dom';

import App from './components/App';
import HistoryStateManager from './utils/HistoryStateManager';
import 'isomorphic-fetch';
import MBRouter from './stores/MBRouter';

// Import styles. This forces webpack to include them in the build, but
// ExtractTextPlugin will strip them from the JS output.
import './../public/less/main.less';

// Enable styles that are based on JS.
document.body.classList.add('js');
document.body.classList.remove('no-js');

// Enable the history state manager.
HistoryStateManager.subscribe();

// Navigate to the page based on url.
MBRouter.navigateToPath(window.location.pathname + window.location.search, null, true);

// Start the app.
ReactDOM.render(
	<App />,
	document.getElementById('AppContainer')
);
