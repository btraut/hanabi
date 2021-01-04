import EscapePage from 'app/src/games/escape/EscapePage';
import Error404Page from 'app/src/pages/Error404Page';
import HomePage from 'app/src/pages/HomePage';
import Page from 'app/src/pages/Page';
import { RouteProps } from 'react-router';

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
