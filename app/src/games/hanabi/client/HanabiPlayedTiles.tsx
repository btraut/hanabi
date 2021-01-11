import { useSocket } from 'app/src/components/SocketContext';
import { useHanabiGame } from 'app/src/games/hanabi/client/HanabiContext';
import HanabiTilePlaceholderView from 'app/src/games/hanabi/client/HanabiTilePlaceholderView';
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
		<div className="">
			<p className="text-xl text-white pl-2">Board:</p>
			<div className="border-4 border-solid border-black bg-white p-4 grid grid-flow-row gap-y-2">
				{colors.map((color) => {
					return (
						<div key={`container-${color}`} className="-mx-0.5 flex">
							{TILE_NUMBERS.map((number) => (
								<div key={`tile-played-${color}-${number}`} className="mx-0.5">
									{greatestPlayedForEachColor[color] !== null &&
									number <= (greatestPlayedForEachColor[color] || 0) ? (
										<HanabiTileView color={color} number={number} />
									) : (
										<HanabiTilePlaceholderView number={number} color={color} />
									)}
								</div>
							))}
						</div>
					);
				})}
			</div>
		</div>
	);
}
