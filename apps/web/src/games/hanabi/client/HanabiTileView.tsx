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
import { CSSProperties, useId } from 'react';

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

	// Optionally show a folded note corner meaning clue information is stored
	// for this tile. This only shows for hidden tiles.
	notesIndicator?: boolean;

	// Render an empty firework position while keeping its required number legible.
	placeholder?: boolean;

	// Give this rendered tile a stable identity across an action state update.
	viewTransitionName?: string;
}

const HANABI_TILE_NUMBER_WIDTH_RATIO = 0.48;

function HanabiTileNoteCorner(): JSX.Element {
	const markerId = useId();
	const paperGradientId = `${markerId}-paper`;
	const shadowBlurId = `${markerId}-shadow`;

	return (
		<span aria-hidden="true" className="hanabi-tile-note-marker pointer-events-none">
			<svg focusable="false" viewBox="0 0 15 15">
				<defs>
					<linearGradient
						id={paperGradientId}
						x1="3"
						y1="3"
						x2="12"
						y2="12"
						gradientUnits="userSpaceOnUse"
					>
						<stop offset="0" stopColor="#fff4dc" />
						<stop offset="0.4" stopColor="#e9ddc5" />
						<stop offset="0.8" stopColor="#b3a58c" />
						<stop offset="1" stopColor="#746954" />
					</linearGradient>
					<filter
						id={shadowBlurId}
						x="-1.5"
						y="-1.5"
						width="18"
						height="18"
						filterUnits="userSpaceOnUse"
						colorInterpolationFilters="sRGB"
					>
						<feGaussianBlur stdDeviation="0.75" />
					</filter>
				</defs>
				<path
					className="hanabi-tile-note-shadow"
					filter={`url(#${shadowBlurId})`}
					transform="translate(.6 .6)"
					d="M3.5 11.5 Q7 7 11.5 3.5 C13.8 9.9 9.9 13.8 3.5 11.5 Z"
				/>
				{/* The tight apex is centered on x=y; the return edge bows under it. */}
				<path
					className="hanabi-tile-note-paper"
					fill={`url(#${paperGradientId})`}
					d="M0 15 C1.7 13.3 2.5 8 3.2 5.2 Q3.6 3.6 5.2 3.2 C8 2.5 13.3 1.7 15 0 C13 6.7 6.7 13 0 15 Z"
				/>
			</svg>
		</span>
	);
}

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
				'hanabi-tile-shell rounded-lg select-none relative',
				{
					'hanabi-tile-emphasis': highlight,
					[`hanabi-tile-emphasis-${highlightTone}`]: highlight,
				},
			])}
		>
			<div
				className={classNames([
					'hanabi-tile-surface bg-black rounded-lg flex items-center justify-center absolute inset-0',
					{
						'hanabi-tile-back': hasConcealedBack,
						'hanabi-tile-face': hasVisibleFace,
						'hanabi-tile-black': color === 'black' && number !== undefined,
						'hanabi-firework-placeholder': placeholder,
						'hanabi-tile-surface-clipped': notesIndicator && hasConcealedBack,
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
			</div>
			{notesIndicator && hasConcealedBack && <HanabiTileNoteCorner />}
		</div>
	);
}
