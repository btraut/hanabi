import * as React from 'react';
import { Route, Switch, RouteProps } from 'react-router-dom';

interface AppProps {
	routes: RouteProps[];
};

const App: React.StatelessComponent<AppProps> = ({ routes }) => (
	<div className="App">
		<Switch>
			{ routes.map(route => <Route key={route.path || '*'} {...route} />) }
		</Switch>
	</div>
);

App.displayName = 'App';

export default App;
