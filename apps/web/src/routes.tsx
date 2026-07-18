import HanabiPage from '~/games/hanabi/HanabiPage';
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
];

export default routes;
