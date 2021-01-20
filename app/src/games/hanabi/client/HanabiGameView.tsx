import HanabiBoard from 'app/src/games/hanabi/client/HanabiBoard';
import { useHanabiGame } from 'app/src/games/hanabi/client/HanabiContext';
import HanabiHighlightTileController from 'app/src/games/hanabi/client/HanabiHighlightTileController';
import HanabiLobby from 'app/src/games/hanabi/client/HanabiLobby';
import HanabiNewestTileController from 'app/src/games/hanabi/client/HanabiNewestTileController';
import HanabiSoundsController from 'app/src/games/hanabi/client/HanabiSoundsController';
import { HanabiStage } from 'app/src/games/hanabi/HanabiGameData';

export default function HanabiGameView(): JSX.Element | null {
	const game = useHanabiGame();

	return (
		<div className="flex flex-col items-center">
			{game.gameData.stage === HanabiStage.Setup && <HanabiLobby />}
			{(game.gameData.stage === HanabiStage.Playing ||
				game.gameData.stage === HanabiStage.Finished) && (
				<HanabiHighlightTileController>
					<HanabiNewestTileController>
						<HanabiSoundsController>
							<HanabiBoard />
						</HanabiSoundsController>
					</HanabiNewestTileController>
				</HanabiHighlightTileController>
			)}
		</div>
	);
}
