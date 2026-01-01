import HanabiPage from '~/games/hanabi/HanabiPage';
import Error404Page from '~/pages/Error404Page';
import Page from '~/pages/Page';
import { ReactNode } from 'react';

interface RouteConfig {
	path?: string;
	element: ReactNode;
	Component?: Page;
}

const routes: RouteConfig[] = [
	{
		path: '/*',
		element: <HanabiPage />,
		Component: HanabiPage,
	},
	{
		path: '*',
		element: <Error404Page />,
		Component: Error404Page,
	},
];

export default routes;
