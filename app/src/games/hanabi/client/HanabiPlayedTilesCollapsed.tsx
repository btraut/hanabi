import { useHanabiAnimationManager } from 'app/src/games/hanabi/client/HanabiContext';
import { useHanabiHighlightContext } from 'app/src/games/hanabi/client/HanabiHighlightContext';
import HanabiTileView, { TileViewSize } from 'app/src/games/hanabi/client/HanabiTileView';
import { HanabiTileColor, HanabiTileNumber } from 'app/src/games/hanabi/HanabiGameData';
import classnames from 'classnames';

const TILE_NUMBERS: HanabiTileNumber[] = [1, 2, 3, 4, 5];

export default function HanabiPlayedTiles(): JSX.Element {
	const animationManager = useHanabiAnimationManager();
	const { displayGameData: gameData } = animationManager;

	const { highlightedTiles } = useHanabiHighlightContext();

	const colors: HanabiTileColor[] = ['red', 'blue', 'green', 'yellow', 'white'];
	if (gameData.ruleSet === 'rainbow') {
		colors.push('rainbow');
	} else if (gameData.ruleSet === '6-color') {
		colors.push('purple');
	}

	const maxScore = colors.length * TILE_NUMBERS.length;

	return (
		<div className="grid grid-flow-col justify-start gap-1 items-center">
			{colors.map((color) => {
				const coloredTiles = gameData.playedTiles
					.map((tid) => gameData.tiles[tid])
					.filter((t) => t.color === color)
					.sort((a, b) => (a.number < b.number ? -1 : 1));
				const greatestTile =
					coloredTiles.length === 0 ? null : coloredTiles[coloredTiles.length - 1];

				return (
					<div
						key={`color-${color}`}
						className={classnames({
							'opacity-20': greatestTile === null,
						})}
					>
						<HanabiTileView
							id={greatestTile === null ? undefined : greatestTile.id}
							color={color}
							number={greatestTile === null ? 1 : greatestTile.number}
							highlight={greatestTile !== null && highlightedTiles.has(greatestTile.id)}
							size={TileViewSize.Small}
						/>
					</div>
				);
			})}
			<div className="text-lg font-bold mx-1">{`${gameData.playedTiles.length}/${maxScore}`}</div>
		</div>
	);
}
