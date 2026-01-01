import { Position } from '@hanabi/shared';

export interface HanabiTileDragItem {
	type: string;
	id: string;
	originalPosition: Position;
	highlight: boolean;
	notesIndicator: boolean;
}

export type HanabiDragTypes = HanabiTileDragItem;

export const HANABI_DRAG_TYPES = {
	TILE: 'tile',
};
