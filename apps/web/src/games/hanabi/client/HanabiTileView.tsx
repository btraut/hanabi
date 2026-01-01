import MagnifyingGlass from '~/games/hanabi/client/icons/MagnifyingGlass';
import {
	HANABI_TILE_SIZE,
	HANABI_TILE_SIZE_SMALL,
	HanabiTileColor,
	HanabiTileNumber,
	tileColorClasses,
} from '@hanabi/shared';
import classNames from 'classnames';

export enum TileViewSize {
	Regular = 'Regular',
	Small = 'Small',
}

interface Props {
	// Tile data:
	color?: HanabiTileColor;
	number?: HanabiTileNumber;

	// Control tile size including overall size and font size.
	size?: TileViewSize;

	// Optionally show dashed highlight lines around the edges.
	highlight?: boolean;

	// Optionally show a little tick mark meaning there has been a clue given
	// for this tile. This only shows for hidden tiles.
	notesIndicator?: boolean;

	// Optionally show a 1px border on this tile.
	border?: boolean;
}

export default function HanabiTileView({
	color,
	number,
	size = TileViewSize.Regular,
	highlight = false,
	notesIndicator = false,
	border = true,
}: Props): JSX.Element | null {
	return (
		<div
			style={size === TileViewSize.Regular ? HANABI_TILE_SIZE : HANABI_TILE_SIZE_SMALL}
			className={classNames([
				'bg-black rounded-lg flex items-center justify-center select-none relative',
				{
					'marquee-highlight': highlight,
					'shadow-light': border,
				},
			])}
		>
			{!!(color && number) && (
				<div
					className={classNames(
						'font-bold pointer-events-none',
						{
							'text-xl': size === TileViewSize.Small,
							'text-3xl': size === TileViewSize.Regular,
						},
						tileColorClasses[color],
					)}
				>
					{number}
				</div>
			)}
			{notesIndicator && (
				<div className="absolute right-0 bottom-0 p-1.5 pointer-events-none">
					<MagnifyingGlass color="yellow" size={12} />
				</div>
			)}
		</div>
	);
}
