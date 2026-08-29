import { HANABI_DRAG_TYPES, HanabiDragTypes } from '~/games/hanabi/client/HanabiDragTypes';
import { CSSProperties } from 'react';
import HanabiTileView from '~/games/hanabi/client/HanabiTileView';
import { useDragLayer } from 'react-dnd';
import { createPortal } from 'react-dom';

interface Props {
	variant?: 'desktop' | 'legacy';
}

export function getHanabiTileDragPreviewStyle(offset: { x: number; y: number }): CSSProperties {
	return {
		left: 0,
		position: 'fixed',
		top: 0,
		transform: `translate3d(${offset.x}px, ${offset.y}px, 0)`,
		zIndex: 1000000,
	};
}

export default function HanabiPlayerTilesDragLayer({
	variant = 'legacy',
}: Props): JSX.Element | null {
	const { itemType, isDragging, item, sourceClientOffset } = useDragLayer((monitor) => ({
		item: monitor.getItem<HanabiDragTypes>(),
		itemType: monitor.getItemType(),
		isDragging: monitor.isDragging(),
		sourceClientOffset: monitor.getSourceClientOffset(),
	}));

	// If we're not dragging, no need for a drag layer.
	if (!isDragging || !item || !sourceClientOffset) {
		return null;
	}

	// If the item being dragged is not a tile, bail.
	if (itemType !== HANABI_DRAG_TYPES.TILE) {
		return null;
	}

	const { highlight, notesIndicator } = item;
	const dragTile = (
		<div
			aria-hidden="true"
			className="pointer-events-none"
			style={getHanabiTileDragPreviewStyle(sourceClientOffset)}
		>
			<div className={variant === 'desktop' ? 'hanabi-player-tile' : undefined}>
				<HanabiTileView
					dimensions={variant === 'desktop' ? item.renderedTileSize : undefined}
					highlight={highlight}
					highlightTone={item.highlightTone}
					notesIndicator={notesIndicator}
				/>
			</div>
		</div>
	);

	return createPortal(dragTile, document.body);
}
