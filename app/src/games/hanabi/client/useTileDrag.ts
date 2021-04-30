import { HANABI_DRAG_TYPES, HanabiDragTypes } from 'app/src/games/hanabi/client/HanabiDragTypes';
import { Position } from 'app/src/games/hanabi/HanabiGameData';
import { useEffect } from 'react';
import { DragElementWrapper, useDrag } from 'react-dnd';
import { getEmptyImage } from 'react-dnd-html5-backend';

export default function useTileDrag(
	id: string,
	position: Position,
	enable = true,
): { isDragging: boolean; dragRef: DragElementWrapper<any> } {
	// Call out to react-dnd.
	const [{ isDragging }, dragRef, preview] = useDrag<
		HanabiDragTypes,
		void,
		{ isDragging: boolean }
	>({
		canDrag: enable,
		item: { type: HANABI_DRAG_TYPES.TILE, id, originalPosition: position },
		collect: (monitor) => ({
			isDragging: !!monitor.isDragging(),
		}),
	});

	// By default, HTML5 drag APIs will screenshot the draggable and show a
	// ghosted version of that screenshot as the user drags it around. Instead,
	// we're going to override that screenshot with an empty image and we'll
	// render and update our own ghosted tile in the drag layer.
	useEffect(() => {
		preview(getEmptyImage());
	}, [preview]);

	return { isDragging, dragRef };
}
