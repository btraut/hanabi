import { getPositionInContainer } from 'app/src/games/hanabi/client/HanabiDragDropUtils';
import { HANABI_DRAG_TYPES, HanabiDragTypes } from 'app/src/games/hanabi/client/HanabiDragTypes';
import HanabiTileView from 'app/src/games/hanabi/client/HanabiTileView';
import { useDragLayer } from 'react-dnd';

export default function HanabiPlayerTilesDragLayer(): JSX.Element | null {
	const { itemType, isDragging, item, delta } = useDragLayer((monitor) => ({
		item: monitor.getItem() as HanabiDragTypes,
		itemType: monitor.getItemType(),
		delta: monitor.getDifferenceFromInitialOffset(),
		isDragging: monitor.isDragging(),
	}));

	// If we're not dragging, no need for a drag layer.
	if (!isDragging || !item || !delta) {
		return null;
	}

	// If the item being dragged is not a tile, bail.
	if (itemType !== HANABI_DRAG_TYPES.TILE) {
		return null;
	}

	const { originalPosition, id, highlight, notesIndicator } = item;
	const newPosition = getPositionInContainer(originalPosition, delta);

	return (
		<div className="absolute inset-0 pointer-events-none">
			<div
				key={`TileContainer-${id}`}
				className="absolute top-0 left-0"
				style={{
					transform: `translate(${newPosition.x}px, ${newPosition.y}px)`,
					zIndex: 1000000,
				}}
			>
				<HanabiTileView highlight={highlight} notesIndicator={notesIndicator} />
			</div>
		</div>
	);
}
