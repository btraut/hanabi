import { useEscapeGame } from 'app/src/games/escape/client/EscapeGameContext';
import EscapeGameLobby from 'app/src/games/escape/client/EscapeGameLobby';
import EscapeGameStage from 'app/src/games/escape/EscapeGameStage';

export default function EscapeGamePlayerView(): JSX.Element | null {
	const game = useEscapeGame();

	if (!game?.gameData) {
		throw new Error('Cannot render with empty game data. This should never happen.');
	}

	if (game.gameData.stage === EscapeGameStage.Open) {
		return <EscapeGameLobby />;
	}

	return null;
}
