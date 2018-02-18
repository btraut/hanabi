import { RouteProps } from 'react-router';

import { PageClass } from './pages/Page';
import Error404Page from './pages/Error404Page';
import HomePage from './pages/HomePage';
import HostViewPage from './pages/HostViewPage';
import PlayerViewPage from './pages/PlayerViewPage';

type AsyncRouteProps = RouteProps & {
	component: PageClass;
};

const routes: AsyncRouteProps[] = [{
	path: '/',
	component: HomePage,
	exact: true
}, {
	path: '/join',
	component: PlayerViewPage,
	exact: true
}, {
	path: '/host',
	component: HostViewPage,
	exact: true
}, {
	component: Error404Page
}];

export default routes;
