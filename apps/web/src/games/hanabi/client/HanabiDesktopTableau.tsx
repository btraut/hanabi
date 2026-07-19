import { getTileViewTransitionName } from '~/games/hanabi/client/HanabiActionTransition';
import HanabiDiscardQueue from '~/games/hanabi/client/HanabiDiscardQueue';
import HanabiTileView from '~/games/hanabi/client/HanabiTileView';
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
	onTileMouseOut?: (event: React.MouseEvent<HTMLElement>, tileId: string) => void;
	onTileMouseOver?: (event: React.MouseEvent<HTMLElement>, tileId: string) => void;
	transitioningTileId?: string | null;
}

const laneColorClasses: Record<HanabiTileColor, string> = {
	red: 'border-hanabi-red/30 bg-hanabi-red/5 text-hanabi-red',
	blue: 'border-hanabi-blue/30 bg-hanabi-blue/5 text-hanabi-blue',
	green: 'border-hanabi-green/30 bg-hanabi-green/5 text-hanabi-green',
	yellow: 'border-hanabi-yellow/30 bg-hanabi-yellow/5 text-hanabi-yellow',
	white: 'border-hanabi-white/30 bg-hanabi-white/5 text-hanabi-white',
	purple: 'border-hanabi-purple/30 bg-hanabi-purple/5 text-hanabi-purple',
	rainbow: 'border-hanabi-border-bright bg-hanabi-surface-raised text-hanabi-coral-soft',
	black: 'border-hanabi-black/40 bg-hanabi-black/5 text-hanabi-black',
};

export function getHanabiPlayedTopTile(
	gameData: Pick<HanabiGameData, 'playedTiles' | 'tiles'>,
	color: HanabiTileColor,
): HanabiTile | null {
	const sequence = getHanabiFireworkSequence(color);
	let topTile: HanabiTile | null = null;
	let topIndex = -1;

	for (const tileId of gameData.playedTiles) {
		const tile = gameData.tiles[tileId];
		if (tile.color !== color) continue;
		const index = sequence.indexOf(tile.number);
		if (index > topIndex) {
			topIndex = index;
			topTile = tile;
		}
	}

	return topTile;
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
	onTileMouseOut,
	onTileMouseOver,
	transitioningTileId = null,
}: Props): JSX.Element {
	return (
		<div aria-label="Fireworks and discards" className="hanabi-panel grid gap-2 rounded-xl p-3">
			{getHanabiRuleSetColors(gameData.ruleSet).map((color) => {
				const headingId = `hanabi-tableau-${color}`;
				const topTile = getHanabiPlayedTopTile(gameData, color);
				const discardedTiles = getHanabiDiscardsForColor(gameData, color);

				return (
					<section
						aria-labelledby={headingId}
						className={`grid min-h-[58px] min-w-0 grid-cols-[24px_40px_minmax(0,1fr)] items-center gap-2 rounded-lg border px-2 py-1 ${laneColorClasses[color]}`}
						data-tableau-color={color}
						key={color}
					>
						<h2 className="sr-only" id={headingId}>
							{color} firework
						</h2>
						<span
							aria-hidden="true"
							className="grid size-6 place-items-center rounded-full border border-current/35 text-sm"
							data-lane-emblem={color}
						>
							✦
						</span>
						<div
							aria-label={
								topTile ? `${color} firework at ${topTile.number}` : `${color} firework is empty`
							}
							className="rounded-lg ring-1 ring-current/25"
						>
							<HanabiTileView
								color={topTile?.color}
								number={topTile?.number}
								placeholder={!topTile}
								viewTransitionName={
									topTile && transitioningTileId === topTile.id
										? getTileViewTransitionName(topTile.id)
										: undefined
								}
							/>
						</div>
						<HanabiDiscardQueue
							color={color}
							highlightedTiles={highlightedTiles}
							onTileMouseOut={onTileMouseOut}
							onTileMouseOver={onTileMouseOver}
							tiles={discardedTiles}
							transitioningTileId={transitioningTileId}
						/>
					</section>
				);
			})}
		</div>
	);
}
