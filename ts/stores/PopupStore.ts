// PopupStore.ts
//
// PopupStore holds a stack of popups that should be displayed. Popups
// are defined as a PopupEntry which contains an actual JSX element and
// some metadata.

import * as _ from 'lodash';
import { StoreBase } from 'resub';

import AutoSubscriptionUtils from '../utils/AutoSubscriptionUtils';

export interface PopupEntry {
	readonly content: JSX.Element;
	readonly canClickOut: boolean;
}

@AutoSubscriptionUtils.AutoSubscribeStore
class PopupStore extends StoreBase {
	private _popupStack: PopupEntry[] = [];

	@AutoSubscriptionUtils.autoSubscribe
	public getTopPopup(): PopupEntry | null {
		return _.last(this._popupStack) || null;
	}
	
	public popPopup() {
		if (this._popupStack.length === 0) {
			return;
		}
		
		const newPopupStack = [...this._popupStack];
		newPopupStack.pop();
		this._popupStack = newPopupStack;
		
		if (document && document.body && this._popupStack.length === 0) {
			document.body.classList.remove('PopupShown');
		}
		
		this.trigger();
	}
	
	public pushPopup(content: JSX.Element, canClickOut: boolean = true) {
		const newPopupStack = [...this._popupStack];
		newPopupStack.push({ content, canClickOut });
		this._popupStack = newPopupStack;
		
		if (document && document.body) {
			document.body.classList.add('PopupShown');
		}
		
		this.trigger();
	}
}

const instance = new PopupStore();
export default instance;
