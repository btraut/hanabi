import { useSocket } from 'app/src/components/SocketContext';
import { useHanabiGame } from 'app/src/games/hanabi/client/HanabiContext';
import { hanabiDragTypes, HanabiTileDragItem } from 'app/src/games/hanabi/client/HanabiDragTypes';
import HanabiTileView from 'app/src/games/hanabi/client/HanabiTileView';
import classnames from 'classnames';
import { useDrop } from 'react-dnd';

interface Props {
	id: string;
}

export default function HanabiPlayerTiles({ id }: Props): JSX.Element {
	const { userId } = useSocket();
	const game = useHanabiGame();

	if (!game || !userId) {
		throw new Error('Must connect/join. This should never happen.');
	}

	const ownTiles = id === userId;
	const thisPlayersTurn = game.gameData.turnOrder[0] === id;

	const [, dropRef] = useDrop<HanabiTileDragItem, void, void>({
		accept: hanabiDragTypes.TILE,
		drop: (item, monitor) => {
			const delta = monitor.getDifferenceFromInitialOffset()!;
			const origintalPosition = game.gameData.players[userId].tileLocations.find(
				(l) => l.tile.id === item.id,
			)!.position;

			const left = Math.round(origintalPosition.x + delta.x);
			const top = Math.round(origintalPosition.y + delta.y);

			console.log('moving', item.id, left, top);
			game.moveTile(userId, item.id, { x: left, y: top });

			return undefined;
		},
	});

	return (
		<div ref={dropRef}>
			<p
				className={classnames([
					'text-xl text-white pl-2',
					{
						italic: thisPlayersTurn,
						'text-yellow-300': thisPlayersTurn,
					},
				])}
			>
				{game.gameData.players[id].name}
				{thisPlayersTurn && <>{': Your turn!'}</>}
			</p>
			<div className="w-tiles h-tiles border-4 border-solid border-black bg-white p-5">
				<div className="relative">
					{game.gameData.players[id].tileLocations.map((tileLocation) => (
						<div
							key={`TileContainer-${tileLocation.tile.id}`}
							className="absolute"
							style={{ top: tileLocation.position.y, left: tileLocation.position.x }}
						>
							<HanabiTileView tile={tileLocation.tile} hidden={ownTiles} draggable={ownTiles} />
						</div>
					))}
				</div>
			</div>
		</div>
	);
}
