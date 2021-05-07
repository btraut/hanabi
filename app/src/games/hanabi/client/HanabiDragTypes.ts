import { Position } from 'app/src/games/hanabi/HanabiGameData';
import { DragObjectWithType } from 'react-dnd';

export interface HanabiTileDragItem extends DragObjectWithType {
	id: string;
	originalPosition: Position;
	highlight: boolean;
	notesIndicator: boolean;
}

export type HanabiDragTypes = HanabiTileDragItem;

export const HANABI_DRAG_TYPES = {
	TILE: 'tile',
};
