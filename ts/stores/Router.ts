import * as _ from 'lodash';
import { StoreBase } from 'resub';
import * as RouteParser from 'route-parser';

import AutoSubscriptionUtils from '../utils/AutoSubscriptionUtils';
import ScrollUtils from '../utils/ScrollUtils';

export const SUBSCRIPTION_KEY_CONTENT = 'SUBSCRIPTION_KEY_CONTENT';
export const SUBSCRIPTION_KEY_LOADING = 'SUBSCRIPTION_KEY_LOADING';

export interface RouteRequest {
	params: any;
	query: any;
	pageParams: any;
}

export interface RouteResult {
	content: JSX.Element | null;
	title: string;
	path: string;
	pageParams: any | null;
	onNavigatedTo: (() => void) | null;
	onNavigatingAway: (() => void) | null;
	skipRoute: boolean;
	redirectExternalPath: string | null;
	redirectPath: string | null;
	redirectParams: any | null;
}

type RouteHandler = (request: RouteRequest, result: RouteResult) => void;

interface Route {
	path: string;
	handlers: RouteHandler[];
}

@AutoSubscriptionUtils.AutoSubscribeStore
class Router extends StoreBase {
	private _routes: Route[] = [];
	private _navigatingToPath = false;
	
	private _content: JSX.Element | null = null;
	private _path = '';
	private _pageParams: any;
	private _replaceHistoryState = false;
	private _pageTitle = '';
	private _loading = false;
	
	private _onNavigatingAway: (() => void) | null = null;
	
	public get navigating() {
		return this._navigatingToPath;
	}
	
	@AutoSubscriptionUtils.autoSubscribeWithKey(SUBSCRIPTION_KEY_CONTENT)
	public getContent() {
		return this._content;
	}
	
	@AutoSubscriptionUtils.autoSubscribeWithKey(SUBSCRIPTION_KEY_CONTENT)
	public getPath() {
		return this._path;
	}
	
	@AutoSubscriptionUtils.autoSubscribeWithKey(SUBSCRIPTION_KEY_CONTENT)
	public getPageParams() {
		return this._pageParams;
	}
	
	@AutoSubscriptionUtils.autoSubscribeWithKey(SUBSCRIPTION_KEY_CONTENT)
	public getReplaceHistoryState() {
		return this._replaceHistoryState;
	}
	
	@AutoSubscriptionUtils.autoSubscribeWithKey(SUBSCRIPTION_KEY_CONTENT)
	public getPageTitle() {
		return this._pageTitle;
	}
	
	@AutoSubscriptionUtils.autoSubscribeWithKey(SUBSCRIPTION_KEY_LOADING)
	public loading() {
		return this._content;
	}
	
	// Rather than navigating to a path, setPath just sets the path
	// and replaceHistoryState flag. The HistoryStateManager can then
	// respond to the trigger and update the history state.
	public setPath(path: string, replaceHistoryState: boolean = false) {
		// It's possible that a route handler can call this method
		// while being navigated to. Throw an error to protect against
		// this case.
		if (this._navigatingToPath) {
			throw new Error('setPath cannot be called during navigateToPath handling.');
		}
		
		// Set new values.
		this._path = path;
		this._replaceHistoryState = replaceHistoryState;
		
		this.trigger(SUBSCRIPTION_KEY_CONTENT);
	}
	
	// Rather than navigating to a path, setPath just sets the path
	// and replaceHistoryState flag. The HistoryStateManager can then
	// respond to the trigger and update the history state.
	public setTitle(title: string) {
		this._pageTitle = title;
		
		this.trigger(SUBSCRIPTION_KEY_CONTENT);
	}
	
	// Register routes in priority order. The first route registered
	// will be the first one considered.
	public addRoute(path: string, ...handlers: RouteHandler[]) {
		this._routes.push({ path, handlers });
	}
	
	// Reload the current page.
	public async reload() {
		return await this.navigateToPath(this._path, this._pageParams, true);
	}
	
	// Attempt to navigate to a page based on the registered routes.
	// If no route matches the given path, an error will be thrown.
	public async navigateToPath(path: string, pageParams: any = {}, replaceHistoryState: boolean = false) {
		try {
			// It's possible that a route handler can call to navigate
			// to a path while it is itself being navigated to. Throw
			// an error to protect against this.
			if (this._navigatingToPath) {
				throw new Error('navigateToPath recursion detected.');
			}
			
			// Track that we're now attempting to navigate.
			this._navigatingToPath = true;
			
			// We're finally navigating away. If there's an existing
			// this._onNavigatingAway method, call it.
			if (this._onNavigatingAway) {
				this._onNavigatingAway();
			}
			
			const handlingRes = await this._findRouteForRequest(path, pageParams);
			
			if (!handlingRes) {
				// Throw an error if no valid route was found.
				throw new Error(`No routes found for "${ path }"`);
			}
			
			if (typeof handlingRes.redirectExternalPath === 'string') {
				window.location.href = handlingRes.redirectExternalPath;
				return;
			}
			
			// Save function params.
			this._content = handlingRes.content;
			this._pageTitle = handlingRes.title;
			this._path = handlingRes.path;
			this._pageParams = handlingRes.pageParams;
			
			this._replaceHistoryState = replaceHistoryState;
			
			this._onNavigatingAway = handlingRes.onNavigatingAway;
			
			// Trigger subscriptions.
			this.trigger(SUBSCRIPTION_KEY_CONTENT);
			
			// Done loading.
			this._loading = false;
			this.trigger(SUBSCRIPTION_KEY_LOADING);
			
			// We're done navigating to the route.
			this._navigatingToPath = false;
			
			// If it specified a onNavigatedTo method, call it.
			if (handlingRes.onNavigatedTo) {
				await (handlingRes.onNavigatedTo as any)();
			}
			
			// Scroll to the top of the page.
			ScrollUtils.scrollTo(0, 0);
			
			// Notify Intercom.
			if ((window as any).Intercom) {
				(window as any).Intercom('update');
			}
		} finally {
			// Make sure we set that we're done navigating so that
			// errors in route handling don't take down the whole app.
			this._navigatingToPath = false;
		}
	}
	
	private async _findRouteForRequest(path: string, pageParams: any = {}): Promise<RouteResult | null> {
		// Split apart the path to look for query params.
		const pathParts = path.split('?');
		const pathname = pathParts[0];
		
		const queryParts = [...pathParts];
		queryParts.splice(0, 1);
		const query = '?' + queryParts.join();
		
		// Iterate over the routes and look for a match. If no match
		// is found, throw an Error. It's assumed that the user will
		// provide a 404 page that matches all routes.
		for (const route of this._routes) {
			// Use RouteParser to see if we have a match and to extract
			// named params.
			const routeParser = new RouteParser(route.path);
			const pathParams = routeParser.match(pathname);
			
			// If we didn't find a match, move on.
			if (!pathParams) {
				continue;
			}
			
			// We've found a match. Start loading.
			this._loading = true;
			this.trigger(SUBSCRIPTION_KEY_LOADING);
			
			// Create req and res objects to be passed to the handler.
			const req = {
				params: pathParams,
				query: this._parseQueryParams(query),
				pageParams
			};
			
			const res: RouteResult = {
				content: null,
				title: '',
				path,
				pageParams,
				onNavigatedTo: null,
				onNavigatingAway: null,
				skipRoute: false,
				redirectExternalPath: null,
				redirectPath: null,
				redirectParams: null
			};
			
			// Fetch content for the route.
			let skipRoute = false;
			let redirectPath: string | null = null;
			let redirectExternalPath: string | null = null;
			let redirectParams: any | null = null;
			
			for (const handler of route.handlers) {
				await handler(req, res);
				
				if (res.skipRoute) {
					skipRoute = true;
					break;
				}
				
				if (typeof res.redirectPath === 'string') {
					redirectPath = res.redirectPath;
					redirectParams = res.redirectParams;
					break;
				}
				
				if (typeof res.redirectExternalPath === 'string') {
					redirectExternalPath = res.redirectExternalPath;
					break;
				}
			}
			
			// Handle route skipping.
			if (skipRoute) {
				continue;
			}
			
			// Handle redirection.
			if (redirectExternalPath) {
				return res;
			}
			
			if (redirectPath) {
				return this._findRouteForRequest(redirectPath, redirectParams);
			}
			
			// If route returned no content, move to the next route.
			if (!res.content) {
				continue;
			}
			
			// The route successfully handled the route.
			return res;
		}
		
		return null;
	}
	
	// Parse the params from a URL that includes pathname and search
	// parts. For example, "/foo/bar?q=123" will return { q: 123 }.
	private _parseQueryParams(query: string = ''): any {
		const params: { [key: string]: string } = {};
		
		if (query === '') {
			return params;
		}
		
		const queryTrimmed = query[0] === '?' ? query.substr(1) : query;
		
		for (const part of queryTrimmed.split('&')) {
			if (part) {
				const item = part.split('=');
				params[item[0]] = decodeURIComponent(item[1]);
			}
		}
		
		return params;
	}
	
	// Convenience method to create a click handler that
	// automatically navigates to the element's href url.
	public overrideHref = (event: React.MouseEvent<HTMLAnchorElement>) => {
		// If the user cmd/ctrl-clicked the link, allow the browser
		// top open a new window.
		if ((event.ctrlKey || event.metaKey) && event.currentTarget.href !== '#') {
			return;
		}
		
		// Prevent the browser from following the link.
		event.preventDefault();
		
		// Split appart the path to look for query params.
		const path = event.currentTarget.getAttribute('href') || '';
		
		// Navigate to the href.
		this.navigateToPath(path);
	}
	
	// Convenience method to create a click handler to
	// navigate to the specified url.
	public createOnClick = _.memoize((url: string, pageParams?: any): any => {
		return (event: React.MouseEvent<HTMLElement>) => {
			// Prevent the browser from following the link.
			event.preventDefault();
			
			// Navigate to the href.
			this.navigateToPath(url, pageParams);
		};
	});
}

const instance = new Router();
export default instance;
