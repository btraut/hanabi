import { useHanabiAnimationManager } from 'app/src/games/hanabi/client/HanabiContext';
import { useHanabiHighlightContext } from 'app/src/games/hanabi/client/HanabiHighlightContext';
import HanabiInteractiveTileView from 'app/src/games/hanabi/client/HanabiInteractiveTileView';
import HanabiTileView, { TileViewSize } from 'app/src/games/hanabi/client/HanabiTileView';
import {
	HANABI_TILE_SIZE,
	HANABI_TILE_SIZE_SMALL,
	HanabiTileColor,
	HanabiTileNumber,
	Position,
} from 'app/src/games/hanabi/HanabiGameData';
import classNames from 'classnames';

const TILE_NUMBERS: HanabiTileNumber[] = [1, 2, 3, 4, 5];
const IDENTITY_POSITION: Position = { x: 0, y: 0, z: 0 };

interface Props {
	readonly tileSize?: TileViewSize;
	readonly onTileMouseOver?: (event: React.MouseEvent<HTMLDivElement>, tileId: string) => void;
	readonly onTileMouseOut?: (event: React.MouseEvent<HTMLDivElement>, tileId: string) => void;
}

export default function HanabiPlayedTiles({
	tileSize: tileViewSize = TileViewSize.Regular,
	onTileMouseOver,
	onTileMouseOut,
}: Props): JSX.Element {
	const animationManager = useHanabiAnimationManager();
	const { displayGameData: gameData } = animationManager;

	const { highlightedTiles } = useHanabiHighlightContext();

	const tileSize =
		tileViewSize === TileViewSize.Regular ? HANABI_TILE_SIZE : HANABI_TILE_SIZE_SMALL;

	const colors: HanabiTileColor[] = ['red', 'blue', 'green', 'yellow', 'white'];
	if (gameData.ruleSet === 'rainbow') {
		colors.push('rainbow');
	} else if (gameData.ruleSet === '6-color') {
		colors.push('purple');
	}

	const greatestPlayedForEachColor: Partial<Record<HanabiTileColor, HanabiTileNumber | null>> = {};

	for (const color of colors) {
		greatestPlayedForEachColor[color] = null;

		for (const number of TILE_NUMBERS) {
			if (
				gameData.playedTiles
					.map((tid) => gameData.tiles[tid])
					.find((t) => t.color === color && t.number === number)
			) {
				greatestPlayedForEachColor[color] = number;
			} else {
				break;
			}
		}
	}

	return (
		<div className="grid grid-flow-row justify-start gap-1 xl:gap-2">
			{colors.map((color) => {
				const discardedTiles = gameData.discardedTiles
					.map((tid) => gameData.tiles[tid])
					.filter((t) => t.color === color);

				return (
					<div
						key={`container-${color}`}
						className="grid grid-flow-col gap-3 xl:gap-4 justify-start items-center"
						style={{ height: tileSize.height }}
					>
						<div className="grid grid-flow-col justify-start gap-0.5 xl:gap-1">
							{TILE_NUMBERS.map((number) => {
								const playedTile = gameData.playedTiles
									.map((tid) => gameData.tiles[tid])
									.find((t) => t.color === color && t.number === number);

								return (
									<div
										key={`tile-played-${color}-${number}`}
										className="relative flex items-center justify-center"
										style={{ width: tileSize.height, height: tileSize.width }}
									>
										<div className="transform rotate-90 absolute">
											<div
												className={classNames({
													'opacity-20': !playedTile,
												})}
											>
												{playedTile ? (
													<HanabiInteractiveTileView
														tile={playedTile}
														position={IDENTITY_POSITION}
														onMouseOver={onTileMouseOver}
														onMouseOut={onTileMouseOut}
														highlight={playedTile && highlightedTiles.has(playedTile.id)}
														size={tileViewSize}
													/>
												) : (
													<HanabiTileView color={color} number={number} size={tileViewSize} />
												)}
											</div>
										</div>
									</div>
								);
							})}
						</div>
						{discardedTiles.length > 0 && (
							<div className="grid grid-flow-col justify-start gap-0.5 xl:gap-1">
								{discardedTiles.map((tile) => (
									<HanabiInteractiveTileView
										key={`discarded-${tile.id}`}
										tile={tile}
										position={IDENTITY_POSITION}
										onMouseOver={onTileMouseOver}
										onMouseOut={onTileMouseOut}
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
