const canUseDOM = !!(
	typeof window !== 'undefined' &&
	window.document &&
	window.document.createElement
);

export default Object.seal({
	canUseDOM,
	canUseWorkers: typeof Worker !== 'undefined',
	canUseEventListeners: canUseDOM && !!(window.addEventListener || (window as any).attachEvent),
	canUseViewport: canUseDOM && !!window.screen
});
