import { useGameData } from '~/games/hanabi/client/HanabiGameContext';
import { HanabiGameActionChat } from '@hanabi/shared';

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
