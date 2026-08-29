import HanabiInteractiveTileView from '~/games/hanabi/client/HanabiInteractiveTileView';
import { getTileViewTransitionName } from '~/games/hanabi/client/HanabiActionTransition';
import { HANABI_DESKTOP_TILE_SIZE } from '~/games/hanabi/client/HanabiDesktopTileGeometry';
import HanabiTileView, { TileViewSize } from '~/games/hanabi/client/HanabiTileView';
import { HanabiTile, HanabiTileColor } from '@hanabi/shared';
import { HanabiTileHighlightTone } from '~/games/hanabi/client/HanabiHighlightContext';

interface Props {
	color: HanabiTileColor;
	highlightedTiles?: ReadonlySet<string>;
	highlightedTone?: HanabiTileHighlightTone;
	onTileMouseOut?: (event: React.MouseEvent<HTMLElement>, tileId: string) => void;
	onTileMouseOver?: (event: React.MouseEvent<HTMLElement>, tileId: string) => void;
	tiles: readonly HanabiTile[];
	transitioningTileId?: string | null;
}

export function getHanabiDiscardQueueGap(tileCount: number): number {
	if (tileCount <= 6) return 2;
	if (tileCount === 7) return -3;
	if (tileCount === 8) return -7;
	if (tileCount === 9) return -11;
	return -17;
}

export default function HanabiDiscardQueue({
	color,
	highlightedTiles = new Set(),
	highlightedTone,
	onTileMouseOut,
	onTileMouseOver,
	tiles,
	transitioningTileId = null,
}: Props): JSX.Element {
	const gap = getHanabiDiscardQueueGap(tiles.length);
	const interactive = onTileMouseOver !== undefined || onTileMouseOut !== undefined;
	const naturalWidth =
		HANABI_DESKTOP_TILE_SIZE.width +
		Math.max(tiles.length - 1, 0) * (HANABI_DESKTOP_TILE_SIZE.width + gap);

	return (
		<div
			aria-label={`${color} discards in chronological order`}
			className="relative h-16 min-w-0 max-w-full"
			data-discard-count={tiles.length}
			data-discard-gap={gap}
			role="list"
			style={{ width: naturalWidth }}
		>
			{tiles.map((tile, index) => {
				const progress = index / Math.max(tiles.length - 1, 1);
				const left =
					index === 0
						? 0
						: index === tiles.length - 1
							? `calc(100% - ${HANABI_DESKTOP_TILE_SIZE.width}px)`
							: `calc(${(progress * 100).toFixed(4)}% - ${(progress * HANABI_DESKTOP_TILE_SIZE.width).toFixed(4)}px)`;

				return (
					<div
						className="absolute top-0 transition-transform hover:z-50 hover:-translate-y-1 focus-within:z-50 focus-within:-translate-y-1"
						key={tile.id}
						role="listitem"
						style={{
							left,
							zIndex: index + 1,
						}}
					>
						{interactive ? (
							<HanabiInteractiveTileView
								dimensions={HANABI_DESKTOP_TILE_SIZE}
								highlight={highlightedTiles.has(tile.id)}
								highlightTone={highlightedTone}
								onMouseOut={onTileMouseOut}
								onMouseOver={onTileMouseOver}
								size={TileViewSize.Regular}
								tile={tile}
								viewTransitionName={
									transitioningTileId === tile.id ? getTileViewTransitionName(tile.id) : undefined
								}
							/>
						) : (
							<HanabiTileView
								color={tile.color}
								dimensions={HANABI_DESKTOP_TILE_SIZE}
								highlight={highlightedTiles.has(tile.id)}
								highlightTone={highlightedTone}
								number={tile.number}
								size={TileViewSize.Regular}
								viewTransitionName={
									transitioningTileId === tile.id ? getTileViewTransitionName(tile.id) : undefined
								}
							/>
						)}
					</div>
				);
			})}
		</div>
	);
}
