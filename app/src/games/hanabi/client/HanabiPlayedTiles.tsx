import { useSocket } from 'app/src/components/SocketContext';
import { useHanabiGame } from 'app/src/games/hanabi/client/HanabiContext';
import HanabiTileView from 'app/src/games/hanabi/client/HanabiTileView';
import { HanabiRuleSet, HanabiTileColor } from 'app/src/games/hanabi/HanabiGameData';

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

	return (
		<div className="">
			{colors.map((color) => {
				const coloredTiles = game.gameData.playedTiles
					.filter((t) => t.color === color)
					.sort((t1, t2) => (t1.number > t2.number ? 1 : -1));

				return (
					<div key={`TileContainer-${color}`} className="">
						{coloredTiles.map((tile) => (
							<HanabiTileView key={`Tile-${color}-${tile.number}`} tile={tile} />
						))}
					</div>
				);
			})}
		</div>
	);
}
