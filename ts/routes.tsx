import { ComponentClass, StatelessComponent } from 'react';
import { Store } from 'redux';

import { StoreData } from './reducers/root';

import HomePage from './pages/HomePage';

interface Route {
	path: string;
	component: ComponentClass | StatelessComponent;
	preload?: (store?: Store<StoreData>) => Promise<void>;
	title?: string;
}

const routes: Route[] = [{
	path: '/',
	component: HomePage,
	preload: async () => { console.log('preloaded HomePage'); }
}];

export default routes;
