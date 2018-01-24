import { RouteProps } from 'react-router';

import { PageClass } from './pages/Page';
import HomePage from './pages/HomePage';

type AsyncRouteProps = RouteProps & {
	component: PageClass;
};

const routes: AsyncRouteProps[] = [{
	path: '/',
	component: HomePage
}];

export default routes;
