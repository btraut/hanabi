import { hanabiDragTypes, HanabiTileDragItem } from 'app/src/games/hanabi/client/HanabiDragTypes';
import HanabiTileView from 'app/src/games/hanabi/client/HanabiTileView';
import {
	HANABI_TILE_SIZE,
	HANABI_TILE_SIZE_SMALL,
	HanabiTile,
} from 'app/src/games/hanabi/HanabiGameData';
import classnames from 'classnames';
import { useCallback, useEffect, useState } from 'react';
import { useDrag } from 'react-dnd';
import { getEmptyImage } from 'react-dnd-html5-backend';

export enum TileViewSize {
	Regular = 'Regular',
	Small = 'Small',
}

interface Props {
	// Tile data:
	tile: HanabiTile;

	// Optionally hide the value of the tile.
	hidden?: boolean;

	// Control tile size including overall size and font size.
	size?: TileViewSize;

	// Can the user drag this tile?
	draggable?: boolean;

	// Optionally show dashed highlight lines around the edges.
	highlight?: boolean;

	// Specify a custom click handler.
	onClick?: (event: React.MouseEvent<HTMLDivElement>, tile: HanabiTile) => void;

	// Optionally show a 1px border on this tile.
	border?: boolean;

	// Allow a "new" badge and animation to play. Enabling doesn't guarantee
	// that it will show because we hide after the user interacts with the tile.
	// Disabling will guarantee that we do not show.
	enableNewAnimation?: boolean;
}

export default function HanabiInteractiveTileView({
	tile,
	hidden = false,
	size = TileViewSize.Regular,
	onClick,
	draggable = false,
	highlight = false,
	border = true,
	enableNewAnimation = false,
}: Props): JSX.Element | null {
	// Keep track of whether we should show the "new tile" animation. If this
	// becomes disabled after mounting but before stopping the animation, stop
	// it automatically.
	const [showNewAnimation, setShowNewAnimation] = useState(enableNewAnimation);
	useEffect(() => {
		setShowNewAnimation(enableNewAnimation);
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
		canDrag: draggable,
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
				onClick(event, tile);
			}
		},
		[onClick, tile],
	);

	if (isDragging) {
		return null;
	}

	const Comp = onClick ? 'button' : 'div';

	return (
		<Comp
			ref={dragRef}
			style={size === TileViewSize.Regular ? HANABI_TILE_SIZE : HANABI_TILE_SIZE_SMALL}
			className={classnames([
				'relative rounded-lg focus:outline-none focus:ring focus:border-blue-800',
				cursor,
				{
					shake: showNewAnimation,
				},
			])}
			onClick={onClick ? handleClick : undefined}
			onMouseDown={handleMouseDown}
		>
			<HanabiTileView
				color={hidden ? undefined : tile.color}
				number={hidden ? undefined : tile.number}
				border={border}
				highlight={highlight}
			/>
			{showNewAnimation && (
				<div className="absolute inset-0 flex items-center justify-center text-white font-bold transform -rotate-45 pointer-events-none">
					New
				</div>
			)}
		</Comp>
	);
}
