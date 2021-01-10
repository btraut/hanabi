import { hanabiDragTypes, HanabiTileDragItem } from 'app/src/games/hanabi/client/HanabiDragTypes';
import { HanabiTile } from 'app/src/games/hanabi/HanabiGameData';
import classnames from 'classnames';
import { useDrag } from 'react-dnd';

interface Props {
	tile: HanabiTile;
	hidden?: boolean;
	draggable?: boolean;
}

const colorClasses = {
	red: 'text-red-500',
	blue: 'text-blue-500',
	green: 'text-green-500',
	yellow: 'text-yellow-500',
	white: 'text-white',
	purple: 'text-purple-500',
};

export default function HanabiTileView({
	tile,
	hidden = false,
	draggable = false,
}: Props): JSX.Element {
	const [{ isDragging }, dragRef] = useDrag<HanabiTileDragItem, void, { isDragging: boolean }>({
		canDrag: draggable,
		item: { type: hanabiDragTypes.TILE, id: tile.id },
		collect: (monitor) => ({
			isDragging: !!monitor.isDragging(),
		}),
	});

	if (draggable && isDragging) {
		return <div ref={dragRef} />;
	}

	return (
		<div
			ref={dragRef}
			className={classnames([
				'bg-black rounded-lg text-3xl font-bold w-10 h-12 flex items-center justify-center select-none',
				colorClasses[tile.color],
				{
					'cursor-move': draggable,
				},
			])}
		>
			{hidden ? '' : String(tile.number)}
		</div>
	);
}
