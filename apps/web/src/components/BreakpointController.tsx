import { BreakpointContextProvider } from '~/components/BreakpointContext';
import { useEffect, useState } from 'react';

interface Props {
	readonly children: JSX.Element | JSX.Element[] | null;
}

const queries = {
	sm: '(min-width: 640px)',
	md: '(min-width: 768px)',
	lg: '(min-width: 1024px)',
	xl: '(min-width: 1280px)',
	'2xl': '(min-width: 1536px)',
} as const;

const readBreakpoints = () => ({
	sm: window.matchMedia(queries.sm).matches,
	md: window.matchMedia(queries.md).matches,
	lg: window.matchMedia(queries.lg).matches,
	xl: window.matchMedia(queries.xl).matches,
	'2xl': window.matchMedia(queries['2xl']).matches,
});

export default function BreakpointController({ children }: Props): JSX.Element {
	const [breakpoints, setBreakpoints] = useState(readBreakpoints);

	useEffect(() => {
		const mediaQueries = Object.values(queries).map((query) => window.matchMedia(query));
		const handleChange = () => setBreakpoints(readBreakpoints());
		mediaQueries.forEach((query) => query.addEventListener('change', handleChange));
		return () => {
			mediaQueries.forEach((query) => query.removeEventListener('change', handleChange));
		};
	}, []);

	return <BreakpointContextProvider value={breakpoints}>{children}</BreakpointContextProvider>;
}
