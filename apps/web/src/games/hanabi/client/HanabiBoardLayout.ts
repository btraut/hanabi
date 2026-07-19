export type HanabiBoardLayout = 'desktop' | 'legacy';

export function getHanabiBoardLayout(breakpoints: { xl: boolean }): HanabiBoardLayout {
	return breakpoints.xl ? 'desktop' : 'legacy';
}
