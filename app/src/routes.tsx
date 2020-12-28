import { RouteProps } from 'react-router';

import Error404Page from './pages/Error404Page';
import EscapePage from './pages/EscapePage';
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
		exact: true,
	},
	{
		component: Error404Page,
	},
];

export default routes;
