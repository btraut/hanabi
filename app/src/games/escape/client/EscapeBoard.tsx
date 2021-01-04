import { useSocket } from 'app/src/components/SocketContext';
import { useEscapeGame } from 'app/src/games/escape/client/EscapeContext';
import useArrowKeys from 'app/src/games/escape/client/useArrowKeys';
import { MAP_SIZE } from 'app/src/games/escape/EscapeRules';
import { Direction } from 'app/src/games/escape/Movement';
import { useCallback } from 'react';

export default function EscapeBoard(): JSX.Element {
	const { userId } = useSocket();
	const game = useEscapeGame();

	if (!game || !userId) {
		throw new Error('Must connect/join. This should never happen.');
	}

	const viewerIsPlayer = !!game.gameData.players[userId];

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
			p.id === userId ? (
				<div key={`player-${p.id}`} className="Escape-BoardDot Escape-BoardDot--Self" />
			) : (
				<div key={`player-${p.id}`} className="Escape-BoardDot" />
			),
		);
	};

	const myLocation = game.gameData.players[userId].location;
	const distanceToPlayers: { [userId: string]: number } = {};
	for (const player of players) {
		distanceToPlayers[player.id] = Math.sqrt(
			Math.pow(player.location.x - myLocation.x, 2) + Math.pow(player.location.y - myLocation.y, 2),
		);
	}

	return (
		<>
			<h1 className="Escape-Subtitle">Game on!</h1>
			<table className="Escape-Board">
				<tbody>
					{new Array(MAP_SIZE.height).fill('').map((_row, rowIndex) => (
						<tr key={`row-${rowIndex}`}>
							{new Array(MAP_SIZE.width).fill('').map((_cell, colIndex) => (
								<td className="Escape-BoardCell" key={`row-${colIndex}`}>
									{buildCell(colIndex, rowIndex)}
								</td>
							))}
						</tr>
					))}
				</tbody>
			</table>
			<p>Close players:</p>
			<ul>
				{players
					.filter(({ id }) => id !== userId)
					.map((player) => (
						<li key={`player-distance-${player.id}`}>{`Distance to ${player.name}: ${
							distanceToPlayers[player.id]
						}`}</li>
					))}
			</ul>
		</>
	);
}
