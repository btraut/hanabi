import { useSocket } from 'app/src/components/SocketContext';
import HanabiClues from 'app/src/games/hanabi/client/HanabiClues';
import { useHanabiGame } from 'app/src/games/hanabi/client/HanabiContext';
import HanabiLives from 'app/src/games/hanabi/client/HanabiLives';
import HanabiPlayedTiles from 'app/src/games/hanabi/client/HanabiPlayedTiles';
import HanabiPlayerTiles from 'app/src/games/hanabi/client/HanabiPlayerTiles';

export default function HanabiBoard(): JSX.Element {
	const { userId } = useSocket();
	const game = useHanabiGame();

	if (!game || !userId) {
		throw new Error('Must connect/join. This should never happen.');
	}

	return (
		<div className="grid grid-flow-col gap-x-10">
			<div>
				{game.gameData.turnOrder.map((id, index) => (
					<div
						className={index < game.gameData.turnOrder.length - 1 ? 'mb-10' : ''}
						key={`player-${id}`}
					>
						<HanabiPlayerTiles id={id} />
					</div>
				))}
			</div>
			<div>
				<p className="text-xl text-white pl-2">Board:</p>
				<div className="border-4 border-solid border-black bg-white p-4 grid grid-flow-row gap-y-4">
					<HanabiClues />
					<HanabiPlayedTiles />
					<div className="py-1">
						<HanabiLives />
					</div>
				</div>
			</div>
		</div>
	);
}
