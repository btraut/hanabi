import { useHanabiGame } from 'app/src/games/hanabi/client/HanabiContext';
import HanabiTileView from 'app/src/games/hanabi/client/HanabiTileView';

export default function HanabiRemainingTiles(): JSX.Element {
	const game = useHanabiGame();

	return (
		<div className="grid grid-cols-12 gap-1">
			{game.gameData.remainingTiles.map((tile, index) => (
				<HanabiTileView
					key={`remaining-${index}`}
					tile={tile}
					hidden={game.gameData.finishedReason === null}
				/>
			))}
		</div>
	);
}
