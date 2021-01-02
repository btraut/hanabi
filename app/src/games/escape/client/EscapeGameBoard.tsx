import { useSocketManager } from 'app/src/components/SocketManagerContext';
import { useEscapeGame } from 'app/src/games/escape/client/EscapeGameContext';
import useArrowKeys from 'app/src/games/escape/client/useArrowKeys';
import { MAP_SIZE } from 'app/src/games/escape/EscapeGameRules';
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

	const players = Object.values(game.gameData.players);
	const buildCell = (x: number, y: number) => {
		const playersInCell = players.filter((p) => p.location.x === x && p.location.y === y);
		return playersInCell.map((p) =>
			p.id === socketManager.userId ? (
				<div key={`player-${p.id}`} className="EscapeGame-BoardDot EscapeGame-BoardDot--Self" />
			) : (
				<div key={`player-${p.id}`} className="EscapeGame-BoardDot" />
			),
		);
	};

	return (
		<>
			<h1 className="EscapeGame-Subtitle">Game on!</h1>
			<table className="EscapeGame-Board">
				<tbody>
					{new Array(MAP_SIZE.height).fill('').map((_row, rowIndex) => (
						<tr key={`row-${rowIndex}`}>
							{new Array(MAP_SIZE.width).fill('').map((_cell, colIndex) => (
								<td className="EscapeGame-BoardCell" key={`row-${colIndex}`}>
									{buildCell(colIndex, rowIndex)}
								</td>
							))}
						</tr>
					))}
				</tbody>
			</table>
		</>
	);
}
