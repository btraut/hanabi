import MBRouter from '../stores/MBRouter';
import { SUBSCRIPTION_KEY_CONTENT } from '../stores/Router';

class HistoryStateManager {
	private _historyStatesEnabled = true;
	private _routerSubscriptionToken: any;
	
	public subscribe() {
		window.addEventListener('popstate', this._handlePopState);
		
		this._routerSubscriptionToken = MBRouter.subscribe(this._createHistoryState, SUBSCRIPTION_KEY_CONTENT);
	}
	
	public unsubscribe() {
		window.removeEventListener('popstate', this._handlePopState);
		
		MBRouter.unsubscribe(this._routerSubscriptionToken);
		this._routerSubscriptionToken = null;
	}
	
	private _handlePopState = async () => {
		// Disable history state setting. The following call to
		// Router.navigateToPath will cause a Router trigger and we don't
		// want to push/replace another state based on that.
		this._historyStatesEnabled = false;
		
		// Tell the router to navigate to the page based on the new url.
		await MBRouter.navigateToPath(window.location.pathname + window.location.search);
		
		// Re-enable history states.
		this._historyStatesEnabled = true;
	}
	
	private _createHistoryState = () => {
		if (!this._historyStatesEnabled) {
			return;
		}
		
		const newUrl = MBRouter.getPath();
		const newTitle = MBRouter.getPageTitle();
		
		if (newUrl === window.location.href) {
			// The URL didn't change at all. Check if the title did.
			if (document.title !== newTitle) {
				history.replaceState(null, newTitle, newUrl);
				document.title = newTitle;
			}
		} else {
			// Update the URL.
			if (MBRouter.getReplaceHistoryState()) {
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
