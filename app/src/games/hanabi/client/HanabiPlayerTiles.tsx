import { useSocket } from 'app/src/components/SocketContext';
import { useHanabiGame } from 'app/src/games/hanabi/client/HanabiContext';
import {
	CONTAINER_SIZE,
	hanabiDragTypes,
	HanabiTileDragItem,
	TILE_SIZE,
} from 'app/src/games/hanabi/client/HanabiDragTypes';
import HanabiPlayerTilesDragLayer from 'app/src/games/hanabi/client/HanabiPlayerTilesDragLayer';
import HanabiTileView from 'app/src/games/hanabi/client/HanabiTileView';
import { HANABI_BOARD_SIZE, HanabiTile } from 'app/src/games/hanabi/HanabiGameData';
import { useDrop } from 'react-dnd';

interface Props {
	id: string;
	onTileClick?: (
		event: React.MouseEvent<HTMLDivElement>,
		tile: HanabiTile,
		ownTile: boolean,
	) => void;
}

export default function HanabiPlayerTiles({ id, onTileClick }: Props): JSX.Element {
	const { userId } = useSocket();
	const game = useHanabiGame();

	if (!game || !userId) {
		throw new Error('Must connect/join. This should never happen.');
	}

	const ownTiles = id === userId;
	const ownTurn = game.gameData.turnOrder[0] === userId;
	const thisPlayersTurn =
		game.gameData.finishedReason === null && game.gameData.turnOrder[0] === id;

	const [, dropRef] = useDrop<HanabiTileDragItem, void, void>({
		accept: hanabiDragTypes.TILE,
		drop: (item, monitor) => {
			const delta = monitor.getDifferenceFromInitialOffset()!;
			const origintalPosition = game.gameData.players[userId].tileLocations.find(
				(l) => l.tile.id === item.id,
			)!.position;

			const left = Math.round(origintalPosition.x + delta.x);
			const top = Math.round(origintalPosition.y + delta.y);

			const leftClamped = Math.min(Math.max(left, 0), CONTAINER_SIZE.width - TILE_SIZE.width);
			const topClamped = Math.min(Math.max(top, 0), CONTAINER_SIZE.height - TILE_SIZE.height);

			game.moveTile(userId, item.id, { x: leftClamped, y: topClamped });

			return undefined;
		},
	});

	return (
		<div ref={dropRef}>
			{thisPlayersTurn && ownTurn && (
				<p className="text-xl text-yellow-300 pl-2 italic">
					{`${game.gameData.players[id].name}: Your turn!`}
				</p>
			)}
			{thisPlayersTurn && !ownTurn && (
				<p className="text-xl text-yellow-300 pl-2 italic">{game.gameData.players[id].name}</p>
			)}
			{!thisPlayersTurn && (
				<p className="text-xl text-white pl-2">{game.gameData.players[id].name}</p>
			)}
			<div className="border-4 border-solid border-black bg-white">
				<div style={HANABI_BOARD_SIZE} className="relative">
					{ownTiles && <HanabiPlayerTilesDragLayer />}
					{game.gameData.players[id].tileLocations.map((tileLocation) => (
						<div
							key={`TileContainer-${tileLocation.tile.id}`}
							className="absolute"
							style={{ top: tileLocation.position.y, left: tileLocation.position.x }}
						>
							<HanabiTileView
								onClick={ownTurn ? onTileClick : undefined}
								tile={tileLocation.tile}
								ownTile={ownTiles}
								draggable={game.gameData.finishedReason === null && ownTiles}
							/>
						</div>
					))}
				</div>
			</div>
		</div>
	);
}
