import { useUserId } from 'app/src/components/SocketContext';
import { useHanabiGame } from 'app/src/games/hanabi/client/HanabiContext';
import { hanabiDragTypes, HanabiTileDragItem } from 'app/src/games/hanabi/client/HanabiDragTypes';
import { useHanabiHighlightTileContext } from 'app/src/games/hanabi/client/HanabiHighlightTileContext';
import { useNewestTile } from 'app/src/games/hanabi/client/HanabiNewestTileContext';
import HanabiPlayerTilesDragLayer from 'app/src/games/hanabi/client/HanabiPlayerTilesDragLayer';
import HanabiTileView from 'app/src/games/hanabi/client/HanabiTileView';
import {
	HANABI_BOARD_SIZE,
	HANABI_TILE_SIZE,
	HanabiTile,
} from 'app/src/games/hanabi/HanabiGameData';
import classnames from 'classnames';
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
	const userId = useUserId();
	const game = useHanabiGame();

	const { highlightedTiles } = useHanabiHighlightTileContext();
	const newestTileId = useNewestTile();

	const ownTiles = id === userId;
	const ownTurn = game.gameData.turnOrder[0] === userId;

	const [, dropRef] = useDrop<HanabiTileDragItem, void, void>({
		accept: hanabiDragTypes.TILE,
		drop: (item, monitor) => {
			const delta = monitor.getDifferenceFromInitialOffset()!;
			const origintalPosition = game.gameData.players[userId].tileLocations.find(
				(l) => l.tile.id === item.id,
			)!.position;

			const left = Math.round(origintalPosition.x + delta.x);
			const top = Math.round(origintalPosition.y + delta.y);

			const leftClamped = Math.min(
				Math.max(left, 0),
				HANABI_BOARD_SIZE.width - HANABI_TILE_SIZE.width,
			);
			const topClamped = Math.min(
				Math.max(top, 0),
				HANABI_BOARD_SIZE.height - HANABI_TILE_SIZE.height,
			);

			game.moveTile(userId, item.id, { x: leftClamped, y: topClamped });

			return undefined;
		},
	});

	const player = game.gameData.players[id];
	const enableOnClick = ownTurn && onTileClick && (ownTiles || game.gameData.clues > 0);

	return (
		<div ref={dropRef}>
			<div className="border-4 border-black bg-white rounded-xl p-0.5">
				<div style={HANABI_BOARD_SIZE} className="relative">
					{player.tileLocations.map((tileLocation) => (
						<div
							key={`TileContainer-${tileLocation.tile.id}`}
							className={classnames('absolute top-0 left-0', {
								'duration-100': !ownTiles,
							})}
							style={{
								transform: `translate(${tileLocation.position.x}px, ${tileLocation.position.y}px)`,
							}}
						>
							<HanabiTileView
								onClick={enableOnClick ? onTileClick : undefined}
								tile={tileLocation.tile}
								ownTile={ownTiles}
								draggable={game.gameData.finishedReason === null && ownTiles}
								highlight={highlightedTiles.has(tileLocation.tile.id)}
								enableNewAnimation={tileLocation.tile.id === newestTileId}
							/>
						</div>
					))}
					{ownTiles && <HanabiPlayerTilesDragLayer />}
				</div>
			</div>
		</div>
	);
}
