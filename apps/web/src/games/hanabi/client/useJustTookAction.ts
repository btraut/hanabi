// useJustTookAction is a hook that returns true if a game action was just
// taken. This is useful if we need to enable animations for a period of time
// after an action was taken, but then disable later.

import { useGameData } from '~/games/hanabi/client/HanabiGameContext';
import { useEffect, useRef } from 'react';

export default function useJustTookAction(duration = 200): boolean {
	const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const gameData = useGameData();

	const actionsLength = gameData.actions.length;

	const lastActionsLengthRef = useRef(actionsLength);

	useEffect(() => {
		if (timeoutRef.current) {
			clearTimeout(timeoutRef.current);
		}

		timeoutRef.current = setTimeout(() => {
			timeoutRef.current = null;
			lastActionsLengthRef.current = actionsLength;
		}, duration);

		return () => {
			if (timeoutRef.current) {
				clearTimeout(timeoutRef.current);
			}
		};
	}, [actionsLength, duration]);

	return actionsLength !== lastActionsLengthRef.current;
}
