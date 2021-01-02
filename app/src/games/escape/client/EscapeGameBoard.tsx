import { useEscapeGame } from 'app/src/games/escape/client/EscapeGameContext';

export default function EscapeGamePlayerView(): JSX.Element {
	const game = useEscapeGame();

	const gameData = game?.gameData;
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
