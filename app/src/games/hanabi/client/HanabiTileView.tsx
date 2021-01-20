import { hanabiDragTypes, HanabiTileDragItem } from 'app/src/games/hanabi/client/HanabiDragTypes';
import {
	HANABI_TILE_SIZE,
	HanabiTile,
	tileColorClasses,
} from 'app/src/games/hanabi/HanabiGameData';
import classnames from 'classnames';
import { useCallback, useEffect, useState } from 'react';
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
	enableNewAnimation?: boolean;
}

export default function HanabiTileView({
	tile,
	onClick,
	placeholder = false,
	ownTile = false,
	draggable = false,
	highlight = false,
	shadow = true,
	enableNewAnimation = false,
}: Props): JSX.Element | null {
	// Keep track of whether we should show the "new tile" animation. If this
	// becomes disabled after mounting but before stopping the animation, stop
	// it automatically.
	const [showNewAnimation, setShowNewAnimation] = useState(enableNewAnimation);

	useEffect(() => {
		if (enableNewAnimation) {
			setShowNewAnimation(enableNewAnimation);
		}
	}, [enableNewAnimation]);

	const handleMouseDown = useCallback(() => {
		setShowNewAnimation(false);
	}, []);

	// Handle drag support.
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

	// By default, HTML5 drag APIs will screenshot the draggable and show a
	// ghosted version of that screenshot as the user drags it around. Instead,
	// we're going to override that screenshot with an empty image and we'll
	// render and update our own ghosted tile in the drag layer.
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

	if (isDragging) {
		return null;
	}

	return (
		<Comp
			ref={dragRef}
			style={HANABI_TILE_SIZE}
			className={classnames([
				'bg-black rounded-lg flex items-center justify-center select-none relative focus:outline-none focus:ring focus:border-blue-800',
				cursor,
				{
					'opacity-20': placeholder,
					'marquee-border': highlight,
					'shadow-light': shadow,
					shake: showNewAnimation,
				},
			])}
			onClick={onClick ? handleClick : undefined}
			onMouseDown={handleMouseDown}
		>
			{!ownTile && (
				<div
					className={classnames(
						'text-3xl font-bold pointer-events-none',
						tileColorClasses[tile.color],
					)}
				>
					{tile.number}
				</div>
			)}
			{showNewAnimation && (
				<div className="text-white font-bold transform -rotate-45 pointer-events-none">New</div>
			)}
		</Comp>
	);
}
