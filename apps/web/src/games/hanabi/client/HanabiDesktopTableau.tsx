import { getTileViewTransitionName } from '~/games/hanabi/client/HanabiActionTransition';
import {
	getHanabiTableauEmblemPath,
	hasGeneratedHanabiTableauEmblem,
} from '~/games/hanabi/client/HanabiArtwork';
import HanabiDiscardQueue from '~/games/hanabi/client/HanabiDiscardQueue';
import { HANABI_DESKTOP_TILE_SIZE } from '~/games/hanabi/client/HanabiDesktopTileGeometry';
import HanabiTileView from '~/games/hanabi/client/HanabiTileView';
import { HanabiTileHighlightTone } from '~/games/hanabi/client/HanabiHighlightContext';
import {
	getHanabiFireworkSequence,
	getHanabiRuleSetColors,
	HanabiGameData,
	HanabiTile,
	HanabiTileColor,
} from '@hanabi/shared';

interface Props {
	gameData: HanabiGameData;
	highlightedTiles?: ReadonlySet<string>;
	highlightedTone?: HanabiTileHighlightTone;
	onTileMouseOut?: (event: React.MouseEvent<HTMLElement>, tileId: string) => void;
	onTileMouseOver?: (event: React.MouseEvent<HTMLElement>, tileId: string) => void;
	transitioningTileId?: string | null;
}

const laneColorClasses: Record<HanabiTileColor, string> = {
	red: 'text-hanabi-red',
	blue: 'text-hanabi-blue',
	green: 'text-hanabi-green',
	yellow: 'text-hanabi-yellow',
	white: 'text-hanabi-white',
	purple: 'text-hanabi-purple',
	rainbow: 'text-hanabi-coral-soft',
	black: 'text-hanabi-black',
};

export function getHanabiPlayedTopTile(
	gameData: Pick<HanabiGameData, 'playedTiles' | 'tiles'>,
	color: HanabiTileColor,
): HanabiTile | null {
	return getHanabiPlayedTilesForColor(gameData, color).at(-1) ?? null;
}

export function getHanabiPlayedTilesForColor(
	gameData: Pick<HanabiGameData, 'playedTiles' | 'tiles'>,
	color: HanabiTileColor,
): HanabiTile[] {
	const sequence = getHanabiFireworkSequence(color);

	return gameData.playedTiles
		.map((tileId) => gameData.tiles[tileId])
		.filter((tile) => tile.color === color)
		.sort((a, b) => sequence.indexOf(a.number) - sequence.indexOf(b.number));
}

export function getHanabiDiscardsForColor(
	gameData: Pick<HanabiGameData, 'discardedTiles' | 'tiles'>,
	color: HanabiTileColor,
): HanabiTile[] {
	return gameData.discardedTiles
		.map((tileId) => gameData.tiles[tileId])
		.filter((tile) => tile.color === color);
}

export default function HanabiDesktopTableau({
	gameData,
	highlightedTiles = new Set(),
	highlightedTone,
	onTileMouseOut,
	onTileMouseOver,
	transitioningTileId = null,
}: Props): JSX.Element {
	return (
		<div aria-label="Fireworks and discards" className="hanabi-desktop-tableau grid gap-[9px]">
			{getHanabiRuleSetColors(gameData.ruleSet).map((color) => {
				const headingId = `hanabi-tableau-${color}`;
				const playedTiles = getHanabiPlayedTilesForColor(gameData, color);
				const topTile = playedTiles.at(-1) ?? null;
				const discardedTiles = getHanabiDiscardsForColor(gameData, color);

				return (
					<section
						aria-labelledby={headingId}
						className={`hanabi-tableau-lane grid h-[90px] min-w-0 grid-cols-[90px_132px_minmax(0,1fr)] items-center gap-5 overflow-hidden rounded-lg border p-0 pr-3 ${laneColorClasses[color]}`}
						data-tableau-color={color}
						key={color}
					>
						<h2 className="sr-only" id={headingId}>
							{color} firework
						</h2>
						{hasGeneratedHanabiTableauEmblem(color) ? (
							<img
								alt=""
								aria-hidden="true"
								className="hanabi-tableau-emblem h-full w-[90px] object-contain p-4 drop-shadow-[0_0_8px_currentColor]"
								data-lane-emblem={color}
								src={getHanabiTableauEmblemPath(color)}
							/>
						) : (
							<span
								aria-hidden="true"
								className="size-12 justify-self-center bg-current"
								data-lane-emblem={color}
								style={{
									background:
										color === 'rainbow'
											? 'linear-gradient(135deg, #ef665f, #e8bd5f, #59b987, #5f9de8, #a78be5)'
											: undefined,
									WebkitMask: `url(${getHanabiTableauEmblemPath(color)}) center / contain no-repeat`,
									mask: `url(${getHanabiTableauEmblemPath(color)}) center / contain no-repeat`,
								}}
							/>
						)}
						<div
							aria-label={
								topTile ? `${color} firework at ${topTile.number}` : `${color} firework is empty`
							}
							className="hanabi-tableau-play-stack flex items-center"
							data-played-count={playedTiles.length}
						>
							{playedTiles.map((tile, index) => (
								<div
									className="hanabi-tableau-played-tile"
									data-played-number={tile.number}
									key={tile.id}
									style={{ zIndex: index + 1 }}
								>
									<HanabiTileView
										color={tile.color}
										dimensions={HANABI_DESKTOP_TILE_SIZE}
										number={tile.number}
										viewTransitionName={
											transitioningTileId === tile.id
												? getTileViewTransitionName(tile.id)
												: undefined
										}
									/>
								</div>
							))}
						</div>
						<div className="min-w-0">
							<HanabiDiscardQueue
								color={color}
								highlightedTiles={highlightedTiles}
								highlightedTone={highlightedTone}
								onTileMouseOut={onTileMouseOut}
								onTileMouseOver={onTileMouseOver}
								tiles={discardedTiles}
								transitioningTileId={transitioningTileId}
							/>
						</div>
					</section>
				);
			})}
		</div>
	);
}
