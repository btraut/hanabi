import { HanabiGameData } from '@hanabi/shared';
import HanabiDesktopStatus from '~/games/hanabi/client/HanabiDesktopStatus';
import { useBotStatusData } from '~/games/hanabi/client/HanabiGameContext';

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
	return (
		<HanabiDesktopStatus
			gameData={{ ...gameData, ...botStatus }}
			userId={userId}
			onShowResult={onShowResult}
		/>
	);
}
