import { useUserId } from 'app/src/components/SocketContext';
import { useHanabiGame } from 'app/src/games/hanabi/client/HanabiContext';
import { hanabiDragTypes } from 'app/src/games/hanabi/client/HanabiDragTypes';
import HanabiTileView from 'app/src/games/hanabi/client/HanabiTileView';
import {
	HANABI_BLANK_TILE,
	HANABI_BOARD_SIZE,
	HANABI_TILE_SIZE,
} from 'app/src/games/hanabi/HanabiGameData';
import { useDragLayer } from 'react-dnd';

export default function HanabiPlayerTilesDragLayer(): JSX.Element | null {
	const userId = useUserId();
	const game = useHanabiGame();

	const { itemType, isDragging, item, differenceFromInitialOffset } = useDragLayer((monitor) => ({
		item: monitor.getItem(),
		itemType: monitor.getItemType(),
		differenceFromInitialOffset: monitor.getDifferenceFromInitialOffset(),
		isDragging: monitor.isDragging(),
	}));

	let tileContainer: JSX.Element | null = null;

	if (itemType === hanabiDragTypes.TILE && item && differenceFromInitialOffset) {
		const tileLocation = game.gameData.players[userId].tileLocations.find(
			(l) => l.tile.id === item.id,
		)!;

		const origintalPosition = tileLocation.position;

		const left = Math.round(origintalPosition.x + differenceFromInitialOffset.x);
		const top = Math.round(origintalPosition.y + differenceFromInitialOffset.y);

		const leftClamped = Math.min(
			Math.max(left, 0),
			HANABI_BOARD_SIZE.width - HANABI_TILE_SIZE.width,
		);
		const topClamped = Math.min(
			Math.max(top, 0),
			HANABI_BOARD_SIZE.height - HANABI_TILE_SIZE.height,
		);

		tileContainer = (
			<div
				key={`TileContainer-${tileLocation.tile.id}`}
				className="absolute top-0 left-0"
				style={{
					transform: `translate(${leftClamped}px, ${topClamped}px)`,
				}}
			>
				<HanabiTileView tile={HANABI_BLANK_TILE} ownTile />
			</div>
		);
	}

	return isDragging ? (
		<div className="absolute inset-0 pointer-events-none">{tileContainer}</div>
	) : null;
}
