import BreakpointController from '~/components/BreakpointController';
import HanabiBoard from '~/games/hanabi/client/HanabiBoard';
import { useGameData } from '~/games/hanabi/client/HanabiGameContext';
import HanabiHeader from '~/games/hanabi/client/HanabiHeader';
import HanabiHighlightTileController from '~/games/hanabi/client/HanabiHighlightController';
import HanabiLobby from '~/games/hanabi/client/HanabiLobby';
import useTileDrop from '~/games/hanabi/client/useTileDrop';
import { HanabiStage } from '@hanabi/shared';

export default function HanabiGameView(): JSX.Element | null {
	const gameData = useGameData();

	// The entire screen should be used as a drop target. This is to work around a
	// limitation of react-dnd where the "return animation" is played when
	// dropping things outside drop targets.
	const dropRef = useTileDrop();

	return (
		<>
			{gameData.stage === HanabiStage.Setup && <HanabiLobby />}
			{(gameData.stage === HanabiStage.Playing || gameData.stage === HanabiStage.Finished) && (
				<HanabiHighlightTileController>
					<BreakpointController>
						<div
							className="w-screen min-h-screen grid grid-flow-row gap-6 content-start"
							// eslint-disable-next-line @typescript-eslint/no-explicit-any
							ref={dropRef as any}
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
