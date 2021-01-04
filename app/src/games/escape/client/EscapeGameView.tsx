import { useSocket } from 'app/src/components/SocketContext';
import EscapeBoard from 'app/src/games/escape/client/EscapeBoard';
import { useEscapeGame } from 'app/src/games/escape/client/EscapeContext';
import EscapeLobby from 'app/src/games/escape/client/EscapeLobby';
import EscapeStage from 'app/src/games/escape/EscapeStage';

export default function EscapeGameView(): JSX.Element | null {
	const game = useEscapeGame();
	const { userId } = useSocket();

	if (!game || !userId) {
		throw new Error('Must connect/join. This should never happen.');
	}

	return (
		<div className="Escape-PlayerView">
			{game.gameData.stage === EscapeStage.Open && <EscapeLobby />}
			{game.gameData.stage === EscapeStage.Started && <EscapeBoard />}
		</div>
	);
}
