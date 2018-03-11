import * as React from 'react';
import { Route, Switch, RouteProps } from 'react-router-dom';

interface AppProps {
	readonly routes: RouteProps[];
}

const App: React.StatelessComponent<AppProps> = ({ routes }) => (
	<Switch>
		{ routes.map(route => <Route key={route.path || '*'} {...route} />) }
	</Switch>
);

App.displayName = 'App';

export default App;
