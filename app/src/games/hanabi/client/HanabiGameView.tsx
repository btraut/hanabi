import BreakpointController from 'app/src/components/BreakpointController';
import HanabiBoard from 'app/src/games/hanabi/client/HanabiBoard';
import { useGameData } from 'app/src/games/hanabi/client/HanabiContext';
import HanabiHeader from 'app/src/games/hanabi/client/HanabiHeader';
import HanabiHighlightTileController from 'app/src/games/hanabi/client/HanabiHighlightController';
import HanabiLobby from 'app/src/games/hanabi/client/HanabiLobby';
import useTileDrop from 'app/src/games/hanabi/client/useTileDrop';
import { HanabiStage } from 'app/src/games/hanabi/HanabiGameData';

export default function HanabiGameView(): JSX.Element | null {
	const gameData = useGameData();

	const dropRef = useTileDrop();

	return (
		<>
			{gameData.stage === HanabiStage.Setup && <HanabiLobby />}
			{(gameData.stage === HanabiStage.Playing || gameData.stage === HanabiStage.Finished) && (
				<HanabiHighlightTileController>
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
					</BreakpointController>
				</HanabiHighlightTileController>
			)}
		</>
	);
}
