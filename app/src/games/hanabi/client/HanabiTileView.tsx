import { hanabiDragTypes, HanabiTileDragItem } from 'app/src/games/hanabi/client/HanabiDragTypes';
import { HanabiTile, tileColorClasses } from 'app/src/games/hanabi/HanabiGameData';
import classnames from 'classnames';
import { useEffect } from 'react';
import { useDrag } from 'react-dnd';
import { getEmptyImage } from 'react-dnd-html5-backend';

interface Props {
	tile: HanabiTile;
	ownTile?: boolean;
	draggable?: boolean;
	onClick?: (event: React.MouseEvent<HTMLDivElement>, tile: HanabiTile, ownTile: boolean) => void;
	placeholder?: boolean;
}

export default function HanabiTileView({
	tile,
	onClick,
	placeholder = false,
	ownTile = false,
	draggable = false,
}: Props): JSX.Element {
	const [{ isDragging }, dragRef, preview] = useDrag<
		HanabiTileDragItem,
		void,
		{ isDragging: boolean }
	>({
		canDrag: draggable && !!tile.id,
		item: { type: hanabiDragTypes.TILE, id: tile.id },
		collect: (monitor) => ({
			isDragging: !!monitor.isDragging(),
		}),
	});

	useEffect(() => {
		preview(getEmptyImage());
	}, [preview]);

	const cursor = draggable ? 'cursor-move' : onClick ? 'cursor-pointer' : 'cursor-default';

	return (
		<div
			ref={dragRef}
			className={classnames([
				'bg-black rounded-lg text-3xl font-bold w-10 h-12 flex items-center justify-center select-none',
				tileColorClasses[tile.color],
				cursor,
				{
					hidden: isDragging,
					'opacity-20': placeholder,
				},
			])}
			onClick={(event) => {
				if (onClick) {
					onClick(event, tile, ownTile);
				}
			}}
		>
			{ownTile ? '' : String(tile.number)}
		</div>
	);
}
