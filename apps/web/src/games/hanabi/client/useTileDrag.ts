import { HANABI_DRAG_TYPES, HanabiTileDragItem } from '~/games/hanabi/client/HanabiDragTypes';
import { HanabiTileHighlightTone } from '~/games/hanabi/client/HanabiHighlightContext';
import { useHanabiMoveTileContext } from '~/games/hanabi/client/HanabiMoveTileContext';
import { HANABI_BOARD_SIZE, HANABI_TILE_SIZE } from '@hanabi/shared';
import { useCallback, useEffect, useRef } from 'react';
import { useDrag } from 'react-dnd';
import { getEmptyImage } from 'react-dnd-html5-backend';

export default function useTileDrag(
	id: string,
	highlight: boolean,
	highlightTone: HanabiTileHighlightTone,
	notesIndicator: boolean,
	enable = true,
	responsiveSurface = false,
): { isDragging: boolean; dragRef: (element: HTMLElement | null) => void } {
	// Grab game data so we can look up position.
	const { tilePositions } = useHanabiMoveTileContext();
	const position = tilePositions[id];

	// Call out to react-dnd.
	const elementRef = useRef<HTMLElement | null>(null);
	const [{ isDragging }, connectDragSource, preview] = useDrag<
		HanabiTileDragItem,
		void,
		{ isDragging: boolean }
	>(
		() => ({
			type: HANABI_DRAG_TYPES.TILE,
			canDrag: enable,
			item: () => {
				const board = elementRef.current?.closest<HTMLElement>('.hanabi-player-board');
				const boardRect = board?.getBoundingClientRect();
				const sourceRect = elementRef.current?.getBoundingClientRect();
				return {
					type: HANABI_DRAG_TYPES.TILE,
					id,
					originalPosition: position,
					highlight,
					highlightTone,
					notesIndicator,
					responsiveSurface,
					renderedTileSize: sourceRect
						? { height: sourceRect.height, width: sourceRect.width }
						: HANABI_TILE_SIZE,
					sourcePosition:
						boardRect && sourceRect
							? { x: sourceRect.left - boardRect.left, y: sourceRect.top - boardRect.top }
							: { x: position.x, y: position.y },
					surfaceSize: board
						? { height: board.clientHeight, width: board.clientWidth }
						: HANABI_BOARD_SIZE,
				};
			},
			collect: (monitor) => ({
				isDragging: !!monitor.isDragging(),
			}),
		}),
		[enable, id, position, highlight, highlightTone, notesIndicator, responsiveSurface],
	);
	const dragRef = useCallback(
		(element: HTMLElement | null) => {
			elementRef.current = element;
			connectDragSource(element);
		},
		[connectDragSource],
	);

	// By default, HTML5 drag APIs will screenshot the draggable and show a
	// ghosted version of that screenshot as the user drags it around. Instead,
	// we're going to override that screenshot with an empty image and we'll
	// render and update our own ghosted tile in the drag layer.
	useEffect(() => {
		preview(getEmptyImage());
	}, [preview]);

	return { isDragging, dragRef };
}
