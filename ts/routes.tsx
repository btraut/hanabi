import { ComponentClass, StatelessComponent } from 'react';
import { Store } from 'redux';

import { StoreData } from './reducers/root';

import HomePage, { preload as preloadHomePage, title as HomePageTitle } from './pages/HomePage';

export interface Route {
	path: string;
	component: ComponentClass | StatelessComponent;
	preload?: (store?: Store<StoreData>) => Promise<void>;
	title?: string | ((store?: Store<StoreData>) => Promise<string>);
}

const routes: Route[] = [{
	path: '/',
	component: HomePage,
	title: HomePageTitle,
	preload: preloadHomePage
}];

export default routes;
