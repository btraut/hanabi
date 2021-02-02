import { useHanabiGame } from 'app/src/games/hanabi/client/HanabiContext';
import { HanabiGameActionGameStarted } from 'app/src/games/hanabi/HanabiGameData';

interface Props {
	action: HanabiGameActionGameStarted;
}

export default function HanabiGameStartedAction({ action }: Props): JSX.Element {
	const game = useHanabiGame();

	const player = game.gameData.players[action.startingPlayerId];

	return (
		<div className="text-md xl:text-lg p-4">
			The game has begun! <span className="font-bold">{player.name}</span> goes first.
		</div>
	);
}
