export type HanabiBoardLayout = 'desktop' | 'mobile' | 'tablet';

export function getHanabiBoardLayout(breakpoints: {
	md: boolean;
	xl: boolean;
}): HanabiBoardLayout {
	if (breakpoints.xl) return 'desktop';
	if (breakpoints.md) return 'tablet';
	return 'mobile';
}
