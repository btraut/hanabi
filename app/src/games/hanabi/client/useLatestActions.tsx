import { useHanabiAnimationManager } from 'app/src/games/hanabi/client/HanabiContext';
import { HanabiGameAction, HanabiGameActionType } from 'app/src/games/hanabi/HanabiGameData';
import { useEffect, useState } from 'react';

export default function useLatestActions(): readonly HanabiGameAction[] {
	const animationManager = useHanabiAnimationManager();
	const { displayGameData: gameData } = animationManager;

	const { actions } = gameData;
	const actionsLength = gameData.actions.length;

	const [latestActionIndex, setLatestActionIndex] = useState(gameData.actions.length);
	const [actionsToProcess, setActionsToProcess] = useState<readonly HanabiGameAction[]>([]);

	useEffect(() => {
		if (actionsLength > latestActionIndex) {
			setLatestActionIndex(actions.length);
			setActionsToProcess(actions.slice(latestActionIndex));
		} else if (actionsLength < latestActionIndex) {
			setLatestActionIndex(actions.length);
			setActionsToProcess(actions);
		}
	}, [actions, actionsLength, latestActionIndex]);

	return actionsToProcess;
}

const TILE_ACTION_TYPES = new Set<HanabiGameActionType>([
	HanabiGameActionType.Play,
	HanabiGameActionType.Discard,
	HanabiGameActionType.GiveColorClue,
	HanabiGameActionType.GiveNumberClue,
]);

export function useLatestTileAction(): HanabiGameAction | undefined {
	const latestActions = useLatestActions();

	for (let i = latestActions.length - 1; i >= 0; i -= 1) {
		if (TILE_ACTION_TYPES.has(latestActions[i].type)) {
			return latestActions[i];
		}
	}

	return undefined;
}
