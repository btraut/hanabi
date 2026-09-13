import { DRAW_TILE_VIEW_TRANSITION_NAME } from './HanabiActionTransition';
import { HanabiGameData } from '@hanabi/shared';
import HanabiDesktopStatus from '~/games/hanabi/client/HanabiDesktopStatus';
import { useBotStatusData, useDrawingTileId } from '~/games/hanabi/client/HanabiGameContext';

export default function HanabiLiveDesktopStatus({
	gameData,
	userId,
	onShowResult,
}: {
	gameData: HanabiGameData;
	userId: string;
	onShowResult?: () => void;
}): JSX.Element {
	const botStatus = useBotStatusData();
	const drawingTileId = useDrawingTileId();
	return (
		<HanabiDesktopStatus
			gameData={{ ...gameData, ...botStatus }}
			userId={userId}
			deckTransitionName={
				drawingTileId && gameData.remainingTiles.at(-1) === drawingTileId
					? DRAW_TILE_VIEW_TRANSITION_NAME
					: undefined
			}
			onShowResult={onShowResult}
		/>
	);
}
