import { HANABI_TILE_BACK_PATH, getHanabiTileFacePath } from '~/games/hanabi/client/HanabiArtwork';
import {
	HANABI_TILE_SIZE,
	HANABI_TILE_SIZE_SMALL,
	HanabiTileColor,
	HanabiTileNumber,
	tileColorClasses,
} from '@hanabi/shared';
import { HanabiTileHighlightTone } from '~/games/hanabi/client/HanabiHighlightContext';
import classNames from 'classnames';
import { CSSProperties } from 'react';

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
	dimensions?: { height: number; width: number };

	// Optionally show dashed highlight lines around the edges.
	highlight?: boolean;
	highlightTone?: HanabiTileHighlightTone;

	// Optionally show a clue seal meaning there has been a clue given
	// for this tile. This only shows for hidden tiles.
	notesIndicator?: boolean;

	// Render an empty firework position while keeping its required number legible.
	placeholder?: boolean;

	// Give this rendered tile a stable identity across an action state update.
	viewTransitionName?: string;
}

const HANABI_TILE_NUMBER_WIDTH_RATIO = 0.48;

export default function HanabiTileView({
	color,
	dimensions,
	number,
	size = TileViewSize.Regular,
	highlight = false,
	highlightTone = 'action',
	notesIndicator = false,
	placeholder = false,
	viewTransitionName,
}: Props): JSX.Element | null {
	const hasVisibleFace = !!(color && number);
	const hasConcealedBack = !color && !number && !placeholder;
	const tileDimensions =
		dimensions ?? (size === TileViewSize.Regular ? HANABI_TILE_SIZE : HANABI_TILE_SIZE_SMALL);

	return (
		<div
			data-hanabi-tile-color={hasVisibleFace ? color : undefined}
			style={
				{
					...tileDimensions,
					'--hanabi-tile-back-art': hasConcealedBack ? `url(${HANABI_TILE_BACK_PATH})` : undefined,
					'--hanabi-tile-face-art': hasVisibleFace
						? `url(${getHanabiTileFacePath(color)})`
						: undefined,
					'--hanabi-tile-number-size': `${tileDimensions.width * HANABI_TILE_NUMBER_WIDTH_RATIO}px`,
					viewTransitionName,
				} as CSSProperties
			}
			className={classNames([
				'bg-black rounded-lg flex items-center justify-center select-none relative',
				{
					'hanabi-tile-back': hasConcealedBack,
					'hanabi-tile-face': hasVisibleFace,
					'hanabi-tile-black': color === 'black' && number !== undefined,
					'hanabi-firework-placeholder': placeholder,
					'hanabi-tile-emphasis': highlight,
					[`hanabi-tile-emphasis-${highlightTone}`]: highlight,
				},
			])}
		>
			{hasVisibleFace && (
				<div
					className={classNames(
						'hanabi-tile-number font-bold pointer-events-none relative z-10',
						{
							'hanabi-tile-black-number': color === 'black',
							'hanabi-tile-white-number': color === 'white',
						},
						tileColorClasses[color],
					)}
				>
					{number}
				</div>
			)}
			{notesIndicator && (
				<span
					aria-hidden="true"
					className="hanabi-clue-token hanabi-tile-note-marker pointer-events-none"
				/>
			)}
		</div>
	);
}
