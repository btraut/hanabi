import { useLatestTileAction } from '~/games/hanabi/client/useLatestActions';
import { useEffect, useState } from 'react';

// Enable hand movement effects briefly after a newly observed gameplay action.
export default function useJustTookAction(duration = 200): boolean {
	const actionId = useLatestTileAction()?.id ?? null;
	const [completedActionId, setCompletedActionId] = useState<string | null>(null);

	useEffect(() => {
		if (actionId === null) return;
		const timeout = setTimeout(() => setCompletedActionId(actionId), duration);
		return () => clearTimeout(timeout);
	}, [actionId, duration]);

	return actionId !== null && actionId !== completedActionId;
}
