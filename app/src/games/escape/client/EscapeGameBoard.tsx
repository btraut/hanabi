import { useEscapeGameManager } from 'app/src/games/escape/client/EscapeGameManagerContext';

export default function EscapeGamePlayerView(): JSX.Element {
	const gameManager = useEscapeGameManager();

	const gameData = gameManager.gameData;
	if (!gameData) {
		throw new Error('Cannot render with empty game data. This should never happen.');
	}

	return (
		<>
			<h1 className="EscapeGame-Subtitle">Game on!</h1>
			<div>map</div>
		</>
	);
}
