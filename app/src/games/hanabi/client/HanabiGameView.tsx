import BreakpointController from 'app/src/components/BreakpointController';
import HanabiBoard from 'app/src/games/hanabi/client/HanabiBoard';
import { useHanabiGame } from 'app/src/games/hanabi/client/HanabiContext';
import HanabiHeader from 'app/src/games/hanabi/client/HanabiHeader';
import HanabiHighlightTileController from 'app/src/games/hanabi/client/HanabiHighlightTileController';
import HanabiLobby from 'app/src/games/hanabi/client/HanabiLobby';
import HanabiNewestTileController from 'app/src/games/hanabi/client/HanabiNewestTileController';
import HanabiSoundsController from 'app/src/games/hanabi/client/HanabiSoundsController';
import HanabiStyles from 'app/src/games/hanabi/client/HanabiStyles';
import useTileDrop from 'app/src/games/hanabi/client/useTileDrop';
import { HanabiStage } from 'app/src/games/hanabi/HanabiGameData';

export default function HanabiGameView(): JSX.Element | null {
	const game = useHanabiGame();

	const dropRef = useTileDrop();

	return (
		<>
			{game.gameData.stage === HanabiStage.Setup && <HanabiLobby />}
			{(game.gameData.stage === HanabiStage.Playing ||
				game.gameData.stage === HanabiStage.Finished) && (
				<HanabiHighlightTileController>
					<HanabiNewestTileController>
						<BreakpointController>
							<div
								className="w-screen min-h-screen grid grid-flow-row gap-6 content-start"
								ref={dropRef}
							>
								<HanabiHeader />
								<div className="justify-self-center">
									<HanabiBoard />
								</div>
								<div id="portal" />
							</div>
							<HanabiStyles />
						</BreakpointController>
						<HanabiSoundsController />
					</HanabiNewestTileController>
				</HanabiHighlightTileController>
			)}
		</>
	);
}
