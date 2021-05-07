import { useGameData } from 'app/src/games/hanabi/client/HanabiContext';
import { HanabiGameActionChat } from 'app/src/games/hanabi/HanabiGameData';

interface Props {
	action: HanabiGameActionChat;
}

export default function HanabiChatAction({ action }: Props): JSX.Element {
	const gameData = useGameData();

	const player = gameData.players[action.playerId];

	return (
		<div className="text-md p-3">
			<span className="font-bold">{player.name}:</span> {action.message}
		</div>
	);
}
