import { useSocket } from 'app/src/components/SocketContext';
import { useHanabiGame } from 'app/src/games/hanabi/client/HanabiContext';
import HanabiPlayedTiles from 'app/src/games/hanabi/client/HanabiPlayedTiles';
import HanabiPlayerTiles from 'app/src/games/hanabi/client/HanabiPlayerTiles';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';

export default function HanabiBoard(): JSX.Element {
	const { userId } = useSocket();
	const game = useHanabiGame();

	if (!game || !userId) {
		throw new Error('Must connect/join. This should never happen.');
	}

	return (
		<DndProvider backend={HTML5Backend}>
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
		</DndProvider>
	);
}
