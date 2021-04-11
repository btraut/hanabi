import { useHanabiAnimationManager } from 'app/src/games/hanabi/client/HanabiContext';
import { HanabiGameAction } from 'app/src/games/hanabi/HanabiGameData';
import { useEffect, useState } from 'react';

export default function useLatestActions(): HanabiGameAction[] {
	const animationManager = useHanabiAnimationManager();
	const { displayGameData: gameData } = animationManager;

	const { actions } = gameData;
	const actionsLength = gameData.actions.length;

	const [latestActionIndex, setLatestActionIndex] = useState(gameData.actions.length);
	const [actionsToProcess, setActionsToProcess] = useState<HanabiGameAction[]>([]);

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
