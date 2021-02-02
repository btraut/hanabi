import {
	HANABI_TILE_SIZE,
	HANABI_TILE_SIZE_SMALL,
	HanabiTileColor,
	HanabiTileNumber,
	tileColorClasses,
} from 'app/src/games/hanabi/HanabiGameData';
import classnames from 'classnames';

export enum TileViewSize {
	Regular = 'Regular',
	Small = 'Small',
}

interface Props {
	// Tile data:
	id?: string;
	color?: HanabiTileColor;
	number?: HanabiTileNumber;

	// Control tile size including overall size and font size.
	size?: TileViewSize;

	// Optionally show dashed highlight lines around the edges.
	highlight?: boolean;

	// Optionally show a 1px border on this tile.
	border?: boolean;
}

export default function HanabiTileView({
	color,
	number,
	size = TileViewSize.Regular,
	highlight = false,
	border = true,
}: Props): JSX.Element | null {
	return (
		<div
			style={size === TileViewSize.Regular ? HANABI_TILE_SIZE : HANABI_TILE_SIZE_SMALL}
			className={classnames([
				'bg-black rounded-lg flex items-center justify-center select-none relative',
				{
					'marquee-highlight': highlight,
					'shadow-light': border,
				},
			])}
		>
			{!!(color && number) && (
				<div
					className={classnames(
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
		</div>
	);
}
