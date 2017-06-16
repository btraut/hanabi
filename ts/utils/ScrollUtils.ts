import EnvironmentUtils from './EnvironmentUtils';

export default class ScrollUtils {
	public static scrollTo(x: number, y: number, scrollDuration: number = 0) {
		// If we're on the server, ignore the call.
		if (!EnvironmentUtils.canUseDOM) {
			return;
		}
		
		// If the duration is 0, no animation needed.
		if (scrollDuration === 0) {
			window.scrollTo(x, y);
			return;
		}
		
		// Animate.
		const initialScrollX = window.scrollX;
		const initialScrollY = window.scrollY;
		
		let scrollCount = 0;
		let oldTimestamp = performance.now();
		
		const scrollMaxX = document.documentElement.scrollWidth - document.documentElement.clientWidth;
		const scrollMaxY = document.documentElement.scrollHeight - document.documentElement.clientHeight;
		
		const step = (newTimestamp: number) => {
			scrollCount += Math.PI / (scrollDuration / (newTimestamp - oldTimestamp));
			if (scrollCount >= Math.PI) {
				window.scrollTo(x, y);
			}
			
			if ((window.scrollX === x || window.scrollX === scrollMaxX) && (window.scrollY === y || window.scrollY === scrollMaxY)) {
				return;
			}
			
			const progress = (1 - Math.cos(scrollCount)) / 2;
			
			window.scrollTo(
				Math.round(x * progress + initialScrollX * (1 - progress)),
				Math.round(y * progress + initialScrollY * (1 - progress))
			);
			
			oldTimestamp = newTimestamp;
			window.requestAnimationFrame(step);
		};
		
		window.requestAnimationFrame(step);
	}
}
