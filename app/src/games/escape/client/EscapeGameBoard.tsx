import { useSocketManager } from 'app/src/components/SocketManagerContext';
import { useEscapeGame } from 'app/src/games/escape/client/EscapeGameContext';
import useArrowKeys from 'app/src/games/escape/client/useArrowKeys';
import { Direction } from 'app/src/games/escape/Movement';
import { useCallback } from 'react';

export default function EscapeGameBoard(): JSX.Element {
	const socketManager = useSocketManager();
	const game = useEscapeGame();

	if (!game) {
		throw new Error('Cannot render with empty game. This should never happen.');
	}

	const viewerIsPlayer = !!(socketManager.userId && game.gameData.players[socketManager.userId]);

	const handleArrowKey = useCallback(
		async (direction: Direction) => {
			if (viewerIsPlayer) {
				await game.move(direction);
			}
		},
		[game, viewerIsPlayer],
	);
	useArrowKeys(handleArrowKey);

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
											<div
												key={`player-${playerId}`}
												className="EscapeGame-BoardDot EscapeGame-BoardDot--Self"
											/>
										) : (
											<div key={`player-${playerId}`} className="EscapeGame-BoardDot" />
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
