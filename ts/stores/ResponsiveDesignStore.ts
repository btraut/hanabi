import { StoreBase } from 'resub';

import AutoSubscriptionUtils from '../utils/AutoSubscriptionUtils';
import EnvironmentUtils from '../utils/EnvironmentUtils';

export const TriggerKeys = {
	MouseDetected: 'mousedetected',
	Orientation: 'orientation',
	Breakpoint: 'breakpoint',
	WindowSize: 'windowsize'
};

export const enum ResponsiveSize {
	ExtraSmall,
	Small,
	Medium,
	Large,
	Giant
};

export const ResponsiveBreakpoints = {
	ExtraSmall: 480,
	Small: 768,
	Medium: 992,
	Large: 1200
};

@AutoSubscriptionUtils.AutoSubscribeStore
class ResponsiveDesignStore extends StoreBase {
	private _mouseDetected = false;
	private _touchDetected = false;
	private _lastTouchStart = 0;
	private _mouseMoveTimeout: any;
	
	private _lastWidth = 0;
	private _lastHeight = 0;
	
	private _currentBreakpoint: ResponsiveSize;
	
	constructor() {
		super();
		
		if (EnvironmentUtils.canUseDOM) {
			document.addEventListener('DOMContentLoaded', this._onDomLoaded);
			
			window.onorientationchange = () => {
				this.trigger();
			};
			
			// Store initial size and trap resize
			this._lastWidth = window.innerWidth;
			this._lastHeight = window.innerHeight;
			this._currentBreakpoint = this._calcBreakpoint();
			
			window.onresize = this._onResize;
			
			// Fire an initial resize event to handle iOS scaling.
			setTimeout(this._onResize, 10);
		}
	}
		
	private _onResize = () => {
		const newWidth = window.innerWidth;
		const newHeight = window.innerHeight;

		const keysChanged: string[] = [];

		if (newWidth !== this._lastWidth || newHeight !== this._lastHeight) {
			// It changed -- tell the world!
			this._lastWidth = newWidth;
			this._lastHeight = newHeight;

			const newBP = this._calcBreakpoint();
			if (newBP !== this._currentBreakpoint) {
				this._currentBreakpoint = newBP;
				keysChanged.push(TriggerKeys.Breakpoint);
			}

			keysChanged.push(TriggerKeys.WindowSize);
		}
		
		if (keysChanged.length > 0) {
			this.trigger(keysChanged);
		}
	}

	private _onDomLoaded = () => {
		document.removeEventListener('DOMContentLoaded', this._onDomLoaded);
		// Attempt to track whether a mouse exists by tracking whether there's a
		// touchstart event within 1000ms of getting a mousemove event.  Ugly hack
		// because touch events on browsers also trigger mousedown/mousemove/
		// mouseup/click events. :(
		const touchStartHandler = () => {
			this._touchDetected = true;
			this._lastTouchStart = Date.now();
			if (this._mouseMoveTimeout) {
				clearTimeout(this._mouseMoveTimeout);
				this._mouseMoveTimeout = 0;
			}
			if (this._mouseDetected) {
				// Don't need to track anything anymore -- both were detected
				document.body.removeEventListener('touchstart', touchStartHandler);
			}
		};
		
		const mouseMoveHandler = () => {
			if (!this._mouseMoveTimeout) {
				if (Math.abs(Date.now() - this._lastTouchStart) > 1000) {
					// No touchstart in the last second
					this._mouseMoveTimeout = setTimeout(() => {
						this._mouseMoveTimeout = 0;
						this._mouseDetected = true;
						document.body.removeEventListener('mousemove', mouseMoveHandler);
						this.trigger(TriggerKeys.MouseDetected);
					}, 1000);
				}
			}
		};
		
		document.body.addEventListener('touchstart', touchStartHandler);
		document.body.addEventListener('mousemove', mouseMoveHandler);
	}

	@AutoSubscriptionUtils.autoSubscribeWithKey(TriggerKeys.MouseDetected)
	public getMouseDetected() {
		return this._mouseDetected;
	}

	@AutoSubscriptionUtils.autoSubscribeWithKey(TriggerKeys.Orientation)
	public getPortraitMode() {
		return Math.abs(Number(window.orientation)) !== 90;
	}

	@AutoSubscriptionUtils.autoSubscribeWithKey(TriggerKeys.Breakpoint)
	public getResponsiveSize(): ResponsiveSize {
		return this._currentBreakpoint;
	}

	private _calcBreakpoint() {
		const size = this.getWindowSize();
		
		if (size.width < ResponsiveBreakpoints.ExtraSmall) {
			return ResponsiveSize.ExtraSmall;
		} else if (size.width < ResponsiveBreakpoints.Small) {
			return ResponsiveSize.Small;
		} else if (size.width < ResponsiveBreakpoints.Medium) {
			return ResponsiveSize.Medium;
		} else if (size.width < ResponsiveBreakpoints.Large) {
			return ResponsiveSize.Large;
		}
		
		return ResponsiveSize.Giant;
	}

	@AutoSubscriptionUtils.autoSubscribeWithKey(TriggerKeys.WindowSize)
	public getWindowSize() {
		return {
			width: this._lastWidth,
			height: this._lastHeight
		};
	}
}

const instance = new ResponsiveDesignStore();
export default instance;
