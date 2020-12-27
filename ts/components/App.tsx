import * as React from 'react';
import { Route, RouteProps,Switch } from 'react-router-dom';

interface AppProps {
	readonly routes: RouteProps[];
}

export default function App({ routes }: AppProps) {
	return (
		<Switch>
			{routes.map((route) => (
				<Route {...route} />
			))}
		</Switch>
	);
}
