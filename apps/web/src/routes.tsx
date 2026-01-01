import HanabiPage from '~/games/hanabi/HanabiPage';
import Error404Page from '~/pages/Error404Page';
import Page from '~/pages/Page';
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
