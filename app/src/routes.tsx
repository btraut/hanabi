import { RouteProps } from 'react-router';

import Error404Page from './pages/Error404Page';
import GamePage from './pages/GamePage';
import HomePage from './pages/HomePage';
import Page from './pages/Page';

type AsyncRouteProps = RouteProps & {
	component: Page;
};

const routes: AsyncRouteProps[] = [
	{
		path: '/',
		component: HomePage,
		exact: true,
	},
	{
		path: '/play',
		component: GamePage,
		exact: true,
	},
	{
		component: Error404Page,
	},
];

export default routes;
