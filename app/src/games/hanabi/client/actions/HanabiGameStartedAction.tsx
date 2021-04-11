import { useHanabiAnimationManager } from 'app/src/games/hanabi/client/HanabiContext';
import { HanabiGameActionGameStarted } from 'app/src/games/hanabi/HanabiGameData';

interface Props {
	action: HanabiGameActionGameStarted;
}

export default function HanabiGameStartedAction({ action }: Props): JSX.Element {
	const animationManager = useHanabiAnimationManager();
	const { displayGameData: gameData } = animationManager;

	const player = gameData.players[action.startingPlayerId];

	return (
		<div className="text-md p-3">
			The game has begun! <span className="font-bold">{player.name}</span> goes first.
		</div>
	);
}
