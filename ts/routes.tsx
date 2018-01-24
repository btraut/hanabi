import { RouteProps } from 'react-router';

import { PageClass } from './pages/Page';
import Error404Page from './pages/Error404Page';
import HomePage from './pages/HomePage';

type AsyncRouteProps = RouteProps & {
	component: PageClass;
};

const routes: AsyncRouteProps[] = [{
	path: '/',
	component: HomePage,
	exact: true
}, {
	path: '*',
	component: Error404Page
}];

export default routes;
