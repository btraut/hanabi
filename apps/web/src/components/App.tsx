import { Route, Routes } from 'react-router-dom';
import { ReactNode } from 'react';

interface RouteConfig {
	path?: string;
	element: ReactNode;
}

interface Props {
	readonly routes: RouteConfig[];
}

export default function App({ routes }: Props): JSX.Element {
	return (
		<Routes>
			{routes.map((route) => (
				<Route key={route.path ?? 'fallback'} path={route.path} element={route.element} />
			))}
		</Routes>
	);
}
