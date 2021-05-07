import { HANABI_DRAG_TYPES, HanabiDragTypes } from 'app/src/games/hanabi/client/HanabiDragTypes';
import { useHanabiMoveTileContext } from 'app/src/games/hanabi/client/HanabiMoveTileContext';
import { useEffect } from 'react';
import { DragElementWrapper, useDrag } from 'react-dnd';
import { getEmptyImage } from 'react-dnd-html5-backend';

export default function useTileDrag(
	id: string,
	highlight: boolean,
	notesIndicator: boolean,
	enable = true,
): { isDragging: boolean; dragRef: DragElementWrapper<any> } {
	// Grab game data so we can look up position.
	const { tilePositions } = useHanabiMoveTileContext();
	const position = tilePositions[id];

	// Call out to react-dnd.
	const [{ isDragging }, dragRef, preview] = useDrag<
		HanabiDragTypes,
		void,
		{ isDragging: boolean }
	>({
		canDrag: enable,
		item: {
			type: HANABI_DRAG_TYPES.TILE,
			id,
			originalPosition: position,
			highlight,
			notesIndicator,
		},
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
