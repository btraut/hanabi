// useJustTookAction is a hook that returns true if a game action was just
// taken. This is useful if we need to enable animations for a period of time
// after an action was taken, but then disable later.

import useLatestActions from 'app/src/games/hanabi/client/useLatestActions';
import { useEffect, useRef, useState } from 'react';

export default function useJustTookAction(duration = 200): boolean {
	const [justTookAction, setJustTookAction] = useState(false);

	const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

	const actionsLength = useLatestActions().length;
	useEffect(() => {
		if (timeoutRef.current) {
			clearTimeout(timeoutRef.current);
		}

		setJustTookAction(true);

		timeoutRef.current = setTimeout(() => {
			setJustTookAction(false);
			timeoutRef.current = undefined;
		}, duration);

		return () => {
			if (timeoutRef.current) {
				setJustTookAction(false);
				clearTimeout(timeoutRef.current);
			}
		};
	}, [actionsLength, duration]);

	return justTookAction;
}
