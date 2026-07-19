import {
	HANABI_DEFAULT_TILE_PADDING,
	HANABI_TILE_SIZE,
	HANABI_WORKSPACE_ZONE_BOUNDARY,
	Position,
	getPositionInContainer,
	getSlotXForDraggingTile,
	isTileInTopHalf,
} from '@hanabi/shared';
import { HANABI_DRAG_TYPES, HanabiDragTypes } from '~/games/hanabi/client/HanabiDragTypes';
import HanabiTileView from '~/games/hanabi/client/HanabiTileView';
import { useDragLayer } from 'react-dnd';

export function getHanabiTileDragPreview(position: Position): {
	position: Position;
	zone: 'freeform' | 'ordered';
} {
	if (!isTileInTopHalf(position)) return { position, zone: 'freeform' };

	return {
		position: {
			x:
				HANABI_DEFAULT_TILE_PADDING +
				(HANABI_DEFAULT_TILE_PADDING + HANABI_TILE_SIZE.width) *
					getSlotXForDraggingTile(position.x),
			y: HANABI_DEFAULT_TILE_PADDING,
			z: position.z,
		},
		zone: 'ordered',
	};
}

export default function HanabiPlayerTilesDragLayer(): JSX.Element | null {
	const { itemType, isDragging, item, delta } = useDragLayer((monitor) => ({
		item: monitor.getItem<HanabiDragTypes>(),
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
	const preview = getHanabiTileDragPreview(newPosition);
	const isOrderedPreview = preview.zone === 'ordered';

	return (
		<div className="absolute inset-0 pointer-events-none">
			<div
				aria-hidden="true"
				className="absolute inset-x-0 border-2 border-hanabi-coral bg-hanabi-coral/10"
				style={
					isOrderedPreview
						? { height: HANABI_WORKSPACE_ZONE_BOUNDARY, top: 0 }
						: { bottom: 0, height: HANABI_WORKSPACE_ZONE_BOUNDARY }
				}
			/>
			<div
				key={`TileContainer-${id}`}
				className="absolute top-0 left-0"
				style={{
					transform: `translate(${preview.position.x}px, ${preview.position.y}px)`,
					zIndex: 1000000,
				}}
			>
				<HanabiTileView highlight={highlight} notesIndicator={notesIndicator} />
			</div>
		</div>
	);
}
