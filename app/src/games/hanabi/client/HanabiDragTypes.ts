import { DragObjectWithType } from 'react-dnd';

export interface HanabiTileDragItem extends DragObjectWithType {
	id: string;
}

export const hanabiDragTypes = {
	TILE: 'tile',
};

export const TILE_SIZE = { width: 40, height: 48 };
export const CONTAINER_SIZE = { width: 500, height: 120 };
