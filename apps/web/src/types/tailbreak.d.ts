declare module 'tailbreak' {
	export interface TailbreakBreakpoints {
		sm: boolean;
		md: boolean;
		lg: boolean;
		xl: boolean;
		'2xl': boolean;
	}

	export function TailbreakFactory(): TailbreakBreakpoints;

	export = TailbreakFactory;
}
