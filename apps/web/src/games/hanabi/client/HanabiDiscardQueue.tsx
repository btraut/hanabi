import HanabiInteractiveTileView from '~/games/hanabi/client/HanabiInteractiveTileView';
import { getTileViewTransitionName } from '~/games/hanabi/client/HanabiActionTransition';
import HanabiTileView, { TileViewSize } from '~/games/hanabi/client/HanabiTileView';
import { HanabiTile, HanabiTileColor } from '@hanabi/shared';

interface Props {
	color: HanabiTileColor;
	highlightedTiles?: ReadonlySet<string>;
	onTileMouseOut?: (event: React.MouseEvent<HTMLElement>, tileId: string) => void;
	onTileMouseOver?: (event: React.MouseEvent<HTMLElement>, tileId: string) => void;
	tiles: readonly HanabiTile[];
	transitioningTileId?: string | null;
}

export function getHanabiDiscardQueueGap(tileCount: number): number {
	if (tileCount <= 6) return 3;
	if (tileCount === 7) return 0;
	if (tileCount === 8) return -3;
	if (tileCount === 9) return -5;
	return -8;
}

export default function HanabiDiscardQueue({
	color,
	highlightedTiles = new Set(),
	onTileMouseOut,
	onTileMouseOver,
	tiles,
	transitioningTileId = null,
}: Props): JSX.Element {
	const gap = getHanabiDiscardQueueGap(tiles.length);
	const interactive = onTileMouseOver !== undefined || onTileMouseOut !== undefined;

	return (
		<div
			aria-label={`${color} discards in chronological order`}
			className="flex min-w-0 items-center"
			data-discard-count={tiles.length}
			data-discard-gap={gap}
			role="list"
		>
			{tiles.map((tile, index) => (
				<div
					className="relative shrink-0 transition-transform hover:z-50 hover:-translate-y-1 focus-within:z-50 focus-within:-translate-y-1"
					key={tile.id}
					role="listitem"
					style={{ marginLeft: index === 0 ? 0 : gap, zIndex: index + 1 }}
				>
					{interactive ? (
						<HanabiInteractiveTileView
							highlight={highlightedTiles.has(tile.id)}
							onMouseOut={onTileMouseOut}
							onMouseOver={onTileMouseOver}
							size={TileViewSize.Small}
							tile={tile}
							viewTransitionName={
								transitioningTileId === tile.id ? getTileViewTransitionName(tile.id) : undefined
							}
						/>
					) : (
						<HanabiTileView
							color={tile.color}
							highlight={highlightedTiles.has(tile.id)}
							number={tile.number}
							size={TileViewSize.Small}
							viewTransitionName={
								transitioningTileId === tile.id ? getTileViewTransitionName(tile.id) : undefined
							}
						/>
					)}
				</div>
			))}
		</div>
	);
}
