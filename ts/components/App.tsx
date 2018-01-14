import * as React from 'react';
import { Route } from 'react-router-dom';

import routes from '../routes';

const App: React.StatelessComponent<{}> = () => (
	<div className="App">
		{ routes.map(route => <Route key={route.path} path={route.path} component={route.component}/>) }
	</div>
);

App.displayName = 'App';

export default App;
