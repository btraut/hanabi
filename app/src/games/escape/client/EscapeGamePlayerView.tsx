import EscapeGameLobby from 'app/src/games/escape/client/EscapeGameLobby';
import { useEscapeGameManager } from 'app/src/games/escape/client/EscapeGameManagerContext';
import EscapeGameStage from 'app/src/games/escape/EscapeGameStage';

export default function EscapeGamePlayerView(): JSX.Element | null {
	const gameManager = useEscapeGameManager();

	const gameData = gameManager.gameData;
	if (!gameData) {
		throw new Error('Cannot render with empty game data. This should never happen.');
	}

	if (gameData.stage === EscapeGameStage.Open) {
		return <EscapeGameLobby />;
	}

	return null;
}
