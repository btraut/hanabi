import { BreakpointContextProvider } from 'app/src/components/BreakpointContext';
import { useEffect, useRef, useState } from 'react';
import Tailbreak from 'tailbreak';

interface Props {
	readonly children: JSX.Element | JSX.Element[] | null;
}

export default function BreakpointController({ children }: Props): JSX.Element {
	const tailbreakRef = useRef(Tailbreak());

	const [breakpoints, setBreakpoints] = useState({
		sm: tailbreakRef.current.sm,
		md: tailbreakRef.current.md,
		lg: tailbreakRef.current.lg,
		xl: tailbreakRef.current.xl,
		'2xl': tailbreakRef.current['2xl'],
	});

	useEffect(() => {
		const handleResize = () => {
			if (
				breakpoints.sm === tailbreakRef.current.sm &&
				breakpoints.md === tailbreakRef.current.md &&
				breakpoints.lg === tailbreakRef.current.lg &&
				breakpoints.xl === tailbreakRef.current.xl &&
				breakpoints['2xl'] === tailbreakRef.current['2xl']
			) {
				return;
			}

			setBreakpoints({
				sm: tailbreakRef.current.sm,
				md: tailbreakRef.current.md,
				lg: tailbreakRef.current.lg,
				xl: tailbreakRef.current.xl,
				'2xl': tailbreakRef.current['2xl'],
			});
		};

		window.addEventListener('resize', handleResize);
		return () => {
			window.removeEventListener('resize', handleResize);
		};
	}, [breakpoints]);

	return <BreakpointContextProvider value={breakpoints}>{children}</BreakpointContextProvider>;
}
