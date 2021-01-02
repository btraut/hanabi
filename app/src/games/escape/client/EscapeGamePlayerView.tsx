import EscapeGameBoard from 'app/src/games/escape/client/EscapeGameBoard';
import { useEscapeGame } from 'app/src/games/escape/client/EscapeGameContext';
import EscapeGameLobby from 'app/src/games/escape/client/EscapeGameLobby';
import EscapeGameStage from 'app/src/games/escape/EscapeGameStage';

export default function EscapeGamePlayerView(): JSX.Element | null {
	const game = useEscapeGame();

	if (!game?.gameData) {
		throw new Error('Cannot render with empty game data. This should never happen.');
	}

	return (
		<>
			{game.gameData.stage === EscapeGameStage.Open && <EscapeGameLobby />}
			{game.gameData.stage === EscapeGameStage.Started && <EscapeGameBoard />}
		</>
	);
}
