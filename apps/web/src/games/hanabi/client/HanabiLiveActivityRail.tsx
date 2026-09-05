import { useUserId } from '~/components/SocketContext';
import HanabiActivityRail from '~/games/hanabi/client/HanabiActivityRail';
import { useActivityData } from '~/games/hanabi/client/HanabiGameContext';

export default function HanabiLiveActivityRail(): JSX.Element {
	const gameData = useActivityData();
	const userId = useUserId();
	return <HanabiActivityRail gameData={gameData} userId={userId} />;
}
