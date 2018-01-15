import * as React from 'react';
import { Route, Switch } from 'react-router-dom';

import { Route as RouteDefinition } from '../routes';

interface AppProps {
	routes: RouteDefinition[];
};

const App: React.StatelessComponent<AppProps> = ({ routes }) => (
	<div className="App">
		<Switch>
			{ routes.map(route => <Route key={route.path} path={route.path} component={route.component}/>) }
		</Switch>
	</div>
);

App.displayName = 'App';

export default App;
