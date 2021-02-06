import { useHanabiGame } from 'app/src/games/hanabi/client/HanabiContext';
import { HanabiGameAction } from 'app/src/games/hanabi/HanabiGameData';
import { useEffect, useState } from 'react';

export default function useLatestActions(): HanabiGameAction[] {
	const game = useHanabiGame();

	const actions = game.gameData.actions;
	const actionsLength = game.gameData.actions.length;

	const [latestActionIndex, setLatestActionIndex] = useState(game.gameData.actions.length);
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
