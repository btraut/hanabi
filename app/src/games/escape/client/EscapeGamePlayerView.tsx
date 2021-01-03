import { useSocketManager } from 'app/src/components/SocketManagerContext';
import EscapeGameBoard from 'app/src/games/escape/client/EscapeGameBoard';
import { useEscapeGame } from 'app/src/games/escape/client/EscapeGameContext';
import EscapeGameLobby from 'app/src/games/escape/client/EscapeGameLobby';
import Streams from 'app/src/games/escape/client/streams/Streams';
import { getScope } from 'app/src/games/escape/EscapeGameMessages';
import { ESCAPE_GAME_TITLE } from 'app/src/games/escape/EscapeGameRules';
import EscapeGameStage from 'app/src/games/escape/EscapeGameStage';

export default function EscapeGamePlayerView(): JSX.Element | null {
	const game = useEscapeGame();
	const socketManager = useSocketManager();

	if (!game || !socketManager.userId) {
		throw new Error('Must connect/join. This should never happen.');
	}

	const viewerIsPlayer = !!game.gameData.players[socketManager.userId];

	return (
		<div className="EscapeGame-PlayerView">
			{game.gameData.stage === EscapeGameStage.Open && <EscapeGameLobby />}
			{game.gameData.stage === EscapeGameStage.Started && <EscapeGameBoard />}
			<Streams
				includeViewer={viewerIsPlayer}
				userId={socketManager.userId}
				hubId={getScope(ESCAPE_GAME_TITLE, game.id)}
			/>
		</div>
	);
}
