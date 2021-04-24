import HanabiTileView from 'app/src/games/hanabi/client/HanabiTileView';
import useTileDrag from 'app/src/games/hanabi/client/useTileDrag';
import {
	HANABI_TILE_SIZE,
	HANABI_TILE_SIZE_SMALL,
	HanabiTile,
} from 'app/src/games/hanabi/HanabiGameData';
import useFocusVisible from 'app/src/utils/client/useFocusVisible';
import classnames from 'classnames';
import { useCallback, useEffect, useState } from 'react';

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
	const { isDragging, dragRef } = useTileDrag(tile.id, draggable);

	const cursor = draggable ? 'cursor-move' : onClick ? 'cursor-pointer' : 'cursor-default';

	const isFocusVisible = useFocusVisible();

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
				'relative rounded-lg focus:outline-none',
				cursor,
				{
					'focus:ring': isFocusVisible,
					'focus:border-blue-800': isFocusVisible,
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
