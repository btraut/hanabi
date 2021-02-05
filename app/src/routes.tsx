import HanabiPage from 'app/src/games/hanabi/HanabiPage';
import Error404Page from 'app/src/pages/Error404Page';
import Page from 'app/src/pages/Page';
import { RouteProps } from 'react-router';

type AsyncRouteProps = RouteProps & {
	component: Page;
};

const routes: AsyncRouteProps[] = [
	{
		path: '/',
		component: HanabiPage,
	},
	{
		component: Error404Page,
	},
];

export default routes;
