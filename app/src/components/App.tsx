import { Route, RouteProps, Switch } from 'react-router-dom';

interface Props {
	readonly routes: RouteProps[];
}

export default function App({ routes }: Props): JSX.Element {
	return (
		<Switch>
			{routes.map((route) => (
				<Route key={String(route.path)} {...route} />
			))}
		</Switch>
	);
}
