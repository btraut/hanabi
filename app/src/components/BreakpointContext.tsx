import { createContext, useContext } from 'react';

interface TailbreakResponse {
	sm: boolean;
	md: boolean;
	lg: boolean;
	xl: boolean;
	'2xl': boolean;
}

const context = createContext<TailbreakResponse | null>(null);

export function useBreakpointContext(): TailbreakResponse {
	const breakpointContext = useContext(context);

	if (breakpointContext === null) {
		throw new Error('useBreakpointContext must be used within a BreakpointContextProvider');
	}

	return breakpointContext;
}

export const BreakpointContextConsumer = context.Consumer;
export const BreakpointContextProvider = context.Provider;
