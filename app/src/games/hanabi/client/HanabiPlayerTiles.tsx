import { useSocket } from 'app/src/components/SocketContext';
import { useHanabiGame } from 'app/src/games/hanabi/client/HanabiContext';
import HanabiTileView from 'app/src/games/hanabi/client/HanabiTileView';

interface Props {
	id: string;
}

export default function HanabiPlayerTiles({ id }: Props): JSX.Element {
	const { userId } = useSocket();
	const game = useHanabiGame();

	if (!game || !userId) {
		throw new Error('Must connect/join. This should never happen.');
	}

	const hideTiles = id === userId;

	return (
		<div>
			<p className="text-xl text-white">{game.gameData.players[id].name}</p>
			<div className="w-tiles h-tiles border-4 border-solid border-black bg-white p-5">
				<div className="relative">
					{game.gameData.players[id].tileLocations.map((tileLocation) => (
						<div
							key={`TileContainer-${tileLocation.tile.id}`}
							className="absolute"
							style={{ top: tileLocation.position.y, left: tileLocation.position.x }}
						>
							<HanabiTileView tile={tileLocation.tile} hidden={hideTiles} />
						</div>
					))}
				</div>
			</div>
		</div>
	);
}
