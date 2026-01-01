import { useGameData } from '~/games/hanabi/client/HanabiGameContext';
import { HanabiGameActionGameStarted } from '@hanabi/shared';

interface Props {
	action: HanabiGameActionGameStarted;
}

export default function HanabiGameStartedAction({ action }: Props): JSX.Element {
	const gameData = useGameData();

	const player = gameData.players[action.startingPlayerId];

	return (
		<div className="text-md p-3">
			The game has begun! <span className="font-bold">{player.name}</span> goes first.
		</div>
	);
}
