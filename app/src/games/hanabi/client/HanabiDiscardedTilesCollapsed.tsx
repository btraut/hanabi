import { useHanabiAnimationManager } from 'app/src/games/hanabi/client/HanabiContext';
import { useHanabiHighlightContext } from 'app/src/games/hanabi/client/HanabiHighlightContext';
import HanabiTileView, { TileViewSize } from 'app/src/games/hanabi/client/HanabiTileView';
import { HanabiTileColor } from 'app/src/games/hanabi/HanabiGameData';
import { Fragment } from 'react';

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

	return (
		<div className="grid grid-flow-col justify-start gap-1 items-center">
			{colors.map((color) => {
				const coloredTiles = gameData.discardedTiles
					.filter((t) => t.color === color)
					.sort((a, b) => (a.number < b.number ? -1 : 1));

				return (
					<Fragment key={`color-${color}`}>
						{coloredTiles.map((tile) => (
							<HanabiTileView
								key={`tile-${tile.id}`}
								id={tile.id}
								color={tile.color}
								number={tile.number}
								size={TileViewSize.Small}
								highlight={highlightedTiles.has(tile.id)}
							/>
						))}
					</Fragment>
				);
			})}
		</div>
	);
}
