import { useSocketManager } from 'app/src/components/SocketManagerContext';
import { useEscapeGame } from 'app/src/games/escape/client/EscapeGameContext';

export default function EscapeGamePlayerView(): JSX.Element {
	const game = useEscapeGame();
	const socketManager = useSocketManager();

	if (!game?.gameData) {
		throw new Error('Cannot render with empty game data. This should never happen.');
	}

	return (
		<>
			<h1 className="EscapeGame-Subtitle">Game on!</h1>
			<table className="EscapeGame-Board">
				<tbody>
					{game.gameData.map.map((row, rowIndex) => (
						<tr key={`row-${rowIndex}`}>
							{row.map((cell, colIndex) => (
								<td className="EscapeGame-BoardCell" key={`row-${colIndex}`}>
									{cell.map((playerId) =>
										playerId === socketManager.userId ? (
											<div className="EscapeGame-BoardDot EscapeGame-BoardDot--Self" />
										) : (
											<div className="EscapeGame-BoardDot" />
										),
									)}
								</td>
							))}
						</tr>
					))}
				</tbody>
			</table>
		</>
	);
}
