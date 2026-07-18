import { useGameData, useTransitioningTileId } from '~/games/hanabi/client/HanabiGameContext';
import { useHanabiHighlightContext } from '~/games/hanabi/client/HanabiHighlightContext';
import { getTileViewTransitionName } from '~/games/hanabi/client/HanabiActionTransition';
import HanabiInteractiveTileView from '~/games/hanabi/client/HanabiInteractiveTileView';
import HanabiTileView, { TileViewSize } from '~/games/hanabi/client/HanabiTileView';
import {
	HANABI_TILE_SIZE,
	HANABI_TILE_SIZE_SMALL,
	getHanabiFireworkSequence,
	getHanabiRuleSetColors,
} from '@hanabi/shared';

interface Props {
	readonly tileSize?: TileViewSize;
	readonly onTileMouseOver?: (event: React.MouseEvent<HTMLElement>, tileId: string) => void;
	readonly onTileMouseOut?: (event: React.MouseEvent<HTMLElement>, tileId: string) => void;
}

export default function HanabiPlayedTiles({
	tileSize: tileViewSize = TileViewSize.Regular,
	onTileMouseOver,
	onTileMouseOut,
}: Props): JSX.Element {
	const gameData = useGameData();
	const transitioningTileId = useTransitioningTileId();

	const { highlightedTiles } = useHanabiHighlightContext();

	const tileSize =
		tileViewSize === TileViewSize.Regular ? HANABI_TILE_SIZE : HANABI_TILE_SIZE_SMALL;

	const colors = getHanabiRuleSetColors(gameData.ruleSet);

	return (
		<div className="grid grid-flow-row justify-start gap-1 xl:gap-2">
			{colors.map((color) => {
				const stackNumbers = getHanabiFireworkSequence(color);
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
							{stackNumbers.map((number) => {
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
											<div className="relative">
												<HanabiTileView
													color={color}
													number={number}
													size={tileViewSize}
													placeholder
												/>
												{playedTile && (
													<div className="absolute inset-0">
														<HanabiTileView
															color={playedTile.color}
															number={playedTile.number}
															size={tileViewSize}
															viewTransitionName={
																transitioningTileId === playedTile.id
																	? getTileViewTransitionName(playedTile.id)
																	: undefined
															}
														/>
													</div>
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
										onMouseOver={onTileMouseOver}
										onMouseOut={onTileMouseOut}
										highlight={highlightedTiles.has(tile.id)}
										size={tileViewSize}
										viewTransitionName={
											transitioningTileId === tile.id
												? getTileViewTransitionName(tile.id)
												: undefined
										}
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
