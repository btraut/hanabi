import { hanabiDragTypes, HanabiTileDragItem } from 'app/src/games/hanabi/client/HanabiDragTypes';
import {
	HANABI_TILE_SIZE,
	HanabiTile,
	tileColorClasses,
} from 'app/src/games/hanabi/HanabiGameData';
import classnames from 'classnames';
import { useCallback, useEffect } from 'react';
import { useDrag } from 'react-dnd';
import { getEmptyImage } from 'react-dnd-html5-backend';

interface Props {
	tile: HanabiTile;
	ownTile?: boolean;
	draggable?: boolean;
	highlight?: boolean;
	onClick?: (event: React.MouseEvent<HTMLDivElement>, tile: HanabiTile, ownTile: boolean) => void;
	placeholder?: boolean;
	shadow?: boolean;
}

export default function HanabiTileView({
	tile,
	onClick,
	placeholder = false,
	ownTile = false,
	draggable = false,
	highlight = false,
	shadow = true,
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

	const handleClick = useCallback(
		(event) => {
			if (onClick) {
				onClick(event, tile, ownTile);
			}
		},
		[onClick, ownTile, tile],
	);

	const Comp = onClick ? 'button' : 'div';

	return (
		<Comp
			ref={dragRef}
			style={HANABI_TILE_SIZE}
			className={classnames([
				'bg-black rounded-lg text-3xl font-bold flex items-center justify-center select-none focus:outline-none focus:ring focus:border-blue-800',
				tileColorClasses[tile.color],
				cursor,
				{
					hidden: isDragging,
					'opacity-20': placeholder,
					'marquee-border': highlight,
					'shadow-light': shadow,
				},
			])}
			onClick={onClick ? handleClick : undefined}
		>
			{ownTile ? '' : String(tile.number)}
		</Comp>
	);
}
