import { useSocket } from 'app/src/components/SocketContext';
import { useHanabiGame } from 'app/src/games/hanabi/client/HanabiContext';
import { useHanabiHighlightTileContext } from 'app/src/games/hanabi/client/HanabiHighlightTileContext';
import HanabiTileView from 'app/src/games/hanabi/client/HanabiTileView';
import {
	HanabiRuleSet,
	HanabiTileColor,
	HanabiTileNumber,
} from 'app/src/games/hanabi/HanabiGameData';

const TILE_NUMBERS: HanabiTileNumber[] = [1, 2, 3, 4, 5];

export default function HanabiPlayedTiles(): JSX.Element {
	const { userId } = useSocket();
	const game = useHanabiGame();

	if (!game || !userId) {
		throw new Error('Must connect/join. This should never happen.');
	}

	const { highlightedTiles } = useHanabiHighlightTileContext();

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
						className="grid grid-flow-col gap-x-4 h-12 justify-start items-center"
					>
						<div className="grid grid-flow-col justify-start gap-x-1">
							{TILE_NUMBERS.map((number) => {
								const playedTile = game.gameData.playedTiles.find(
									(t) => t.color === color && t.number === number,
								);

								return (
									<div
										key={`tile-played-${color}-${number}`}
										className="w-12 h-10 relative flex items-center justify-center"
									>
										<div className="transform rotate-90 absolute">
											<HanabiTileView
												tile={
													playedTile
														? playedTile
														: {
																id: '',
																color,
																number,
														  }
												}
												highlight={playedTile && highlightedTiles.has(playedTile.id)}
												placeholder={!playedTile}
											/>
										</div>
									</div>
								);
							})}
						</div>
						{discardedTiles.length > 0 && (
							<div className="grid grid-flow-col justify-start gap-x-1">
								{discardedTiles.map((tile) => (
									<HanabiTileView
										key={`discarded-${tile.id}`}
										tile={tile}
										highlight={highlightedTiles.has(tile.id)}
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
