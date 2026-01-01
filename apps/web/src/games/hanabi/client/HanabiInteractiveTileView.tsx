import HanabiTileView from '~/games/hanabi/client/HanabiTileView';
import useTileDrag from '~/games/hanabi/client/useTileDrag';
import {
	HANABI_TILE_SIZE,
	HANABI_TILE_SIZE_SMALL,
	HanabiTile,
} from '@hanabi/shared';
import useFocusVisible from '~/utils/client/useFocusVisible';
import classNames from 'classnames';
import { useCallback } from 'react';

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

	// Optionally show a little tick mark meaning there has been a clue given
	// for this tile. This only shows for hidden tiles.
	notesIndicator?: boolean;

	// Specify custom event handlers.
	onClick?: (event: React.MouseEvent<HTMLDivElement>, tileId: string) => void;
	onMouseOver?: (event: React.MouseEvent<HTMLDivElement>, tileId: string) => void;
	onMouseOut?: (event: React.MouseEvent<HTMLDivElement>, tileId: string) => void;
	onMouseDown?: (event: React.MouseEvent<HTMLDivElement>, tileId: string) => void;

	// Optionally show a 1px border on this tile.
	border?: boolean;
}

export default function HanabiInteractiveTileView({
	tile,
	hidden = false,
	size = TileViewSize.Regular,
	onClick,
	onMouseOver,
	onMouseOut,
	onMouseDown,
	draggable = false,
	highlight = false,
	notesIndicator = false,
	border = true,
}: Props): JSX.Element | null {
	const isFocusVisible = useFocusVisible();

	const cursor = draggable ? 'cursor-move' : onClick ? 'cursor-pointer' : 'cursor-default';

	const { isDragging, dragRef } = useTileDrag(tile.id, highlight, notesIndicator, draggable);

	const handleClick = useCallback(
		(event) => {
			if (onClick) {
				onClick(event, tile.id);
			}
		},
		[onClick, tile],
	);
	const handleMouseOver = useCallback(
		(event) => {
			if (onMouseOver) {
				onMouseOver(event, tile.id);
			}
		},
		[onMouseOver, tile],
	);
	const handleMouseOut = useCallback(
		(event) => {
			if (onMouseOut) {
				onMouseOut(event, tile.id);
			}
		},
		[onMouseOut, tile],
	);

	const handleMouseDown = useCallback(
		(event) => {
			if (onMouseDown) {
				onMouseDown(event, tile.id);
			}
		},
		[onMouseDown, tile],
	);

	const Comp = onClick ? 'button' : 'div';

	return (
		<Comp
			ref={dragRef}
			style={size === TileViewSize.Regular ? HANABI_TILE_SIZE : HANABI_TILE_SIZE_SMALL}
			className={classNames([
				'rounded-lg focus:outline-none',
				cursor,
				{
					'focus:ring': isFocusVisible,
					'focus:border-blue-800': isFocusVisible,
					'opacity-0': isDragging,
				},
			])}
			onClick={onClick ? handleClick : undefined}
			onMouseOver={onMouseOver ? handleMouseOver : undefined}
			onMouseOut={onMouseOut ? handleMouseOut : undefined}
			onMouseDown={onMouseDown ? handleMouseDown : undefined}
		>
			<HanabiTileView
				color={hidden ? undefined : tile.color}
				number={hidden ? undefined : tile.number}
				border={border}
				highlight={highlight}
				notesIndicator={hidden && notesIndicator}
				size={size}
			/>
		</Comp>
	);
}
