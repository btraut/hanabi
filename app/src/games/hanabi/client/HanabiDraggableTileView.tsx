import { hanabiDragTypes, HanabiTileDragItem } from 'app/src/games/hanabi/client/HanabiDragTypes';
import HanabiTileView from 'app/src/games/hanabi/client/HanabiTileView';
import { HanabiTile } from 'app/src/games/hanabi/HanabiGameData';
import classnames from 'classnames';
import { useEffect } from 'react';
import { useDrag } from 'react-dnd';
import { getEmptyImage } from 'react-dnd-html5-backend';

interface Props {
	tile: HanabiTile;
	hidden?: boolean;
}

export default function HanabiDraggableTileView({ tile, hidden = false }: Props): JSX.Element {
	const [{ isDragging }, dragRef, preview] = useDrag<
		HanabiTileDragItem,
		void,
		{ isDragging: boolean }
	>({
		item: { type: hanabiDragTypes.TILE, id: tile.id },
		collect: (monitor) => ({
			isDragging: !!monitor.isDragging(),
		}),
	});

	useEffect(() => {
		preview(getEmptyImage());
	}, [preview]);

	return (
		<div
			ref={dragRef}
			className={classnames('cursor-move', {
				hidden: isDragging,
			})}
		>
			<HanabiTileView tile={tile} hidden={hidden} />
		</div>
	);
}
