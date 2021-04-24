import { hanabiDragTypes, HanabiTileDragItem } from 'app/src/games/hanabi/client/HanabiDragTypes';
import { useEffect } from 'react';
import { DragElementWrapper, useDrag } from 'react-dnd';
import { getEmptyImage } from 'react-dnd-html5-backend';

export default function useTileDrag(
	tileId: string,
	enable = true,
): { isDragging: boolean; dragRef: DragElementWrapper<any> } {
	// Call out to react-dnd.
	const [{ isDragging }, dragRef, preview] = useDrag<
		HanabiTileDragItem,
		void,
		{ isDragging: boolean }
	>({
		canDrag: enable,
		item: { type: hanabiDragTypes.TILE, id: tileId },
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
