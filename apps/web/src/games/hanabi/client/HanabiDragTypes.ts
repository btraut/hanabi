import {
	HANABI_BOARD_SIZE,
	Position,
	getPositionInContainer,
	isTileInTopHalf,
} from '@hanabi/shared';
import { getHanabiDesktopLogicalPositionFromRendered } from '~/games/hanabi/client/HanabiDesktopTileGeometry';
import { HanabiTileHighlightTone } from '~/games/hanabi/client/HanabiHighlightContext';

export interface HanabiTileDragItem {
	type: string;
	id: string;
	originalPosition: Position;
	highlight: boolean;
	highlightTone: HanabiTileHighlightTone;
	notesIndicator: boolean;
	responsiveSurface: boolean;
	renderedTileSize: { height: number; width: number };
	sourcePosition: { x: number; y: number };
	surfaceSize: { height: number; width: number };
}

export type HanabiDragTypes = HanabiTileDragItem;

export const HANABI_DRAG_TYPES = {
	TILE: 'tile',
};

export function scaleHanabiDragDelta(
	delta: { x: number; y: number },
	surfaceSize: { height: number; width: number },
	logicalSize: { height: number; width: number },
): { x: number; y: number } {
	return {
		x: delta.x * (logicalSize.width / Math.max(surfaceSize.width, 1)),
		y: delta.y * (logicalSize.height / Math.max(surfaceSize.height, 1)),
	};
}

export function getHanabiPositionForDrag(
	item: HanabiTileDragItem,
	delta: { x: number; y: number },
): Position {
	if (item.responsiveSurface) {
		return getHanabiDesktopLogicalPositionFromRendered(
			{
				x: item.sourcePosition.x + delta.x,
				y: item.sourcePosition.y + delta.y,
				z: item.originalPosition.z,
			},
			item.surfaceSize.width,
			item.renderedTileSize,
		);
	}

	const logicalDelta = scaleHanabiDragDelta(delta, item.surfaceSize, HANABI_BOARD_SIZE);
	const slotRelativePosition = getPositionInContainer(item.originalPosition, logicalDelta);

	if (isTileInTopHalf(slotRelativePosition)) return slotRelativePosition;

	const renderedSourcePosition = {
		x: item.sourcePosition.x * (HANABI_BOARD_SIZE.width / Math.max(item.surfaceSize.width, 1)),
		y: item.sourcePosition.y * (HANABI_BOARD_SIZE.height / Math.max(item.surfaceSize.height, 1)),
		z: item.originalPosition.z,
	};

	return getPositionInContainer(renderedSourcePosition, logicalDelta);
}
