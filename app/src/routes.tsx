import { RouteProps } from 'react-router';

import EscapePage from './games/escape/EscapePage';
import Error404Page from './pages/Error404Page';
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
		path: '/escape',
		component: EscapePage,
	},
	{
		component: Error404Page,
	},
];

export default routes;
