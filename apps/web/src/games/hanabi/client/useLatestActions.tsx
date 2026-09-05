import { useBoardData } from '~/games/hanabi/client/HanabiGameContext';
import { HanabiGameAction, HanabiGameActionType } from '@hanabi/shared';
import { useEffect, useState } from 'react';

const NO_ACTIONS: readonly HanabiGameAction[] = [];

export function getAppendedActions(
	previous: readonly HanabiGameAction[],
	next: readonly HanabiGameAction[],
): readonly HanabiGameAction[] {
	const previousId = previous.at(-1)?.id;
	if (!previousId) return next;
	const overlap = next.findIndex(({ id }) => id === previousId);
	// A replacement log is a reset or a reconnect without a shared cursor.
	// Treat it as the baseline rather than replaying its historical events.
	return overlap < 0 ? NO_ACTIONS : next.slice(overlap + 1);
}

function useAppendedActions(actions: readonly HanabiGameAction[]): readonly HanabiGameAction[] {
	const [observed, setObserved] = useState({ actions, appended: NO_ACTIONS });
	if (observed.actions !== actions) {
		setObserved({ actions, appended: getAppendedActions(observed.actions, actions) });
	}
	return observed.appended;
}

export default function useLatestActions(): readonly HanabiGameAction[] {
	return useAppendedActions(useBoardData().actions);
}

const TILE_ACTION_TYPES = new Set<HanabiGameActionType>([
	HanabiGameActionType.Play,
	HanabiGameActionType.Discard,
	HanabiGameActionType.GiveColorClue,
	HanabiGameActionType.GiveNumberClue,
]);

export function useLatestTileAction(): HanabiGameAction | undefined {
	const tileActions = useLatestActions().filter((action) => TILE_ACTION_TYPES.has(action.type));
	// Several missed turns can arrive together after reconnecting. There is no
	// individual presentation for those turns, so skip their sounds and effects.
	return tileActions.length === 1 ? tileActions[0] : undefined;
}

export function useActionListEffect(
	actions: readonly HanabiGameAction[],
	handler: (action: HanabiGameAction | null) => void,
): void {
	const latestAction = useAppendedActions(actions).at(-1) ?? null;
	useEffect(() => {
		handler(latestAction);
	}, [handler, latestAction]);
}

export function useLatestActionEffect(handler: (action: HanabiGameAction | null) => void): void {
	useActionListEffect(useBoardData().actions, handler);
}
