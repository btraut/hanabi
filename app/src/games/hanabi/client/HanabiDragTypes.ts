import { DragObjectWithType } from 'react-dnd';

export interface HanabiTileDragItem extends DragObjectWithType {
	id: string;
}

export const hanabiDragTypes = {
	TILE: 'tile',
};
