import { useSocket } from 'app/src/components/SocketContext';
import { useHanabiGame } from 'app/src/games/hanabi/client/HanabiContext';
import HanabiPlayedTiles from 'app/src/games/hanabi/client/HanabiPlayedTiles';
import HanabiPlayerTiles from 'app/src/games/hanabi/client/HanabiPlayerTiles';

export default function HanabiBoard(): JSX.Element {
	const { userId } = useSocket();
	const game = useHanabiGame();

	if (!game || !userId) {
		throw new Error('Must connect/join. This should never happen.');
	}

	return (
		<div>
			<HanabiPlayedTiles />
			{game.gameData.turnOrder.map((id, index) => (
				<div
					className={index < game.gameData.turnOrder.length - 1 ? 'mb-10' : ''}
					key={`Player-${id}`}
				>
					<HanabiPlayerTiles id={id} />
				</div>
			))}
		</div>
	);
}
