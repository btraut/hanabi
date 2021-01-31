import { useHanabiGame } from 'app/src/games/hanabi/client/HanabiContext';
import { useHanabiHighlightTileContext } from 'app/src/games/hanabi/client/HanabiHighlightTileContext';
import HanabiTileView, { TileViewSize } from 'app/src/games/hanabi/client/HanabiTileView';
import {
	HANABI_TILE_SIZE,
	HANABI_TILE_SIZE_SMALL,
	HanabiRuleSet,
	HanabiTileColor,
	HanabiTileNumber,
} from 'app/src/games/hanabi/HanabiGameData';
import classnames from 'classnames';

const TILE_NUMBERS: HanabiTileNumber[] = [1, 2, 3, 4, 5];

export enum PlayedTileSize {
	Regular = 'Regular',
	Small = 'Small',
}

interface Props {
	readonly size?: PlayedTileSize;
}

export default function HanabiPlayedTiles({ size = PlayedTileSize.Regular }: Props): JSX.Element {
	const game = useHanabiGame();

	const { highlightedTiles } = useHanabiHighlightTileContext();

	const tileViewSize = size === PlayedTileSize.Regular ? TileViewSize.Regular : TileViewSize.Small;
	const tileSize = size === PlayedTileSize.Regular ? HANABI_TILE_SIZE : HANABI_TILE_SIZE_SMALL;

	const colors: HanabiTileColor[] = ['red', 'blue', 'green', 'yellow', 'white'];
	if (game.gameData.ruleSet !== HanabiRuleSet.Basic) {
		colors.push('purple');
	}

	const greatestPlayedForEachColor: Partial<Record<HanabiTileColor, HanabiTileNumber | null>> = {};

	for (const color of colors) {
		greatestPlayedForEachColor[color] = null;

		for (const number of TILE_NUMBERS) {
			if (game.gameData.playedTiles.find((t) => t.color === color && t.number === number)) {
				greatestPlayedForEachColor[color] = number;
			} else {
				break;
			}
		}
	}

	return (
		<div className="grid grid-flow-row justify-start gap-y-2">
			{colors.map((color) => {
				const discardedTiles = game.gameData.discardedTiles.filter((t) => t.color === color);

				return (
					<div
						key={`container-${color}`}
						className="grid grid-flow-col gap-x-4 justify-start items-center"
						style={{ height: tileSize.height }}
					>
						<div className="grid grid-flow-col justify-start gap-x-1">
							{TILE_NUMBERS.map((number) => {
								const playedTile = game.gameData.playedTiles.find(
									(t) => t.color === color && t.number === number,
								);

								return (
									<div
										key={`tile-played-${color}-${number}`}
										className="relative flex items-center justify-center"
										style={{ width: tileSize.height, height: tileSize.width }}
									>
										<div className="transform rotate-90 absolute">
											<div
												className={classnames({
													'opacity-20': !playedTile,
												})}
											>
												<HanabiTileView
													id={playedTile ? playedTile.id : undefined}
													color={color}
													number={number}
													highlight={playedTile && highlightedTiles.has(playedTile.id)}
													size={tileViewSize}
												/>
											</div>
										</div>
									</div>
								);
							})}
						</div>
						{discardedTiles.length > 0 && (
							<div className="grid grid-flow-col justify-start gap-x-1">
								{discardedTiles.map((tile) => (
									<HanabiTileView
										id={tile.id}
										color={tile.color}
										number={tile.number}
										key={`discarded-${tile.id}`}
										highlight={highlightedTiles.has(tile.id)}
										size={tileViewSize}
									/>
								))}
							</div>
						)}
					</div>
				);
			})}
		</div>
	);
}
