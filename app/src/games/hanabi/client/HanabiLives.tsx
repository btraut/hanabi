import { useSocket } from 'app/src/components/SocketContext';
import { useHanabiGame } from 'app/src/games/hanabi/client/HanabiContext';
import HanabiLife from 'app/src/games/hanabi/client/HanabiLife';
import { HANABI_LIVES } from 'app/src/games/hanabi/HanabiGameData';

export default function HanabiClues(): JSX.Element {
	const { userId } = useSocket();
	const game = useHanabiGame();

	if (!game || !userId) {
		throw new Error('Must connect/join. This should never happen.');
	}

	const remainingLives = game.gameData.lives;

	return (
		<div className="grid grid-flow-col justify-start gap-x-1">
			{new Array(HANABI_LIVES + 1).fill('').map((_, index) => (
				<HanabiLife key={`clue-${index}`} placeholder={index > remainingLives} />
			))}
		</div>
	);
}
