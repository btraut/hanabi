import Router, { SUBSCRIPTION_KEY_CONTENT } from '../stores/Router';

class HistoryStateManager {
	private _historyStatesEnabled = true;
	private _routerSubscriptionToken: any;
	
	public subscribe() {
		window.addEventListener('popstate', this._handlePopState);
		
		this._routerSubscriptionToken = Router.subscribe(this._createHistoryState, SUBSCRIPTION_KEY_CONTENT);
	}
	
	public unsubscribe() {
		window.removeEventListener('popstate', this._handlePopState);
		
		Router.unsubscribe(this._routerSubscriptionToken);
		this._routerSubscriptionToken = null;
	}
	
	private _handlePopState = async () => {
		// Disable history state setting. The following call to
		// Router.navigateToPath will cause a Router trigger and we don't
		// want to push/replace another state based on that.
		this._historyStatesEnabled = false;
		
		// Tell the router to navigate to the page based on the new url.
		await Router.navigateToPath(window.location.pathname + window.location.search);
		
		// Re-enable history states.
		this._historyStatesEnabled = true;
	}
	
	private _createHistoryState = () => {
		if (!this._historyStatesEnabled) {
			return;
		}
		
		const newUrl = Router.getPath();
		const newTitle = Router.getPageTitle();
		
		if (newUrl === window.location.href) {
			// The URL didn't change at all. Check if the title did.
			if (document.title !== newTitle) {
				history.replaceState(null, newTitle, newUrl);
				document.title = newTitle;
			}
		} else {
			// Update the URL.
			if (Router.getReplaceHistoryState()) {
				history.replaceState(null, newTitle, newUrl);
			} else {
				history.pushState(null, newTitle, newUrl);
			}
			
			// Update the title.
			document.title = newTitle;
		}
	}
}

const instance = new HistoryStateManager();
export default instance;
