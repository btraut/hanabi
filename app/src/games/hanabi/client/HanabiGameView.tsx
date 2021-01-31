import BreakpointController from 'app/src/components/BreakpointController';
import HanabiBoard from 'app/src/games/hanabi/client/HanabiBoard';
import { useHanabiGame } from 'app/src/games/hanabi/client/HanabiContext';
import { hanabiDragTypes } from 'app/src/games/hanabi/client/HanabiDragTypes';
import HanabiHeader from 'app/src/games/hanabi/client/HanabiHeader';
import HanabiHighlightTileController from 'app/src/games/hanabi/client/HanabiHighlightTileController';
import HanabiLobby from 'app/src/games/hanabi/client/HanabiLobby';
import HanabiNewestTileController from 'app/src/games/hanabi/client/HanabiNewestTileController';
import HanabiSoundsController from 'app/src/games/hanabi/client/HanabiSoundsController';
import HanabiStyles from 'app/src/games/hanabi/client/HanabiStyles';
import { HanabiStage } from 'app/src/games/hanabi/HanabiGameData';
import { useDrop } from 'react-dnd';

export default function HanabiGameView(): JSX.Element | null {
	const game = useHanabiGame();

	// The entire screen should be used as a drop target. This is to work around
	// a limitation of HTML5 drag and drop API where the "return animation" is
	// played when dropping things outside drop targets.
	const [, dropRef] = useDrop({
		accept: [hanabiDragTypes.TILE],
		drop: (_, monitor) => {
			if (monitor.getDropResult()) {
				return;
			}

			return { handled: false };
		},
	});

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
