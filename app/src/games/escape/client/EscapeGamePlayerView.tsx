import EscapeGameJoinForm from 'app/src/games/escape/client/EscapeGameJoinForm';
import { useEscapeGameManager } from 'app/src/games/escape/client/EscapeGameManagerContext';
import useSocketManager from 'app/src/utils/client/useSocketManager';

export default function EscapeGamePlayerView(): JSX.Element {
	const gameManager = useEscapeGameManager();
	const socketManager = useSocketManager();

	const gameData = gameManager.gameData;

	if (!gameData) {
		return <h1 className="HostView-Title">Loading…</h1>;
	}

	const userIsJoined = socketManager.userId && !!gameData.players[socketManager.userId];

	return (
		<>
			<h1 className="HostView-Title">LFM</h1>
			<ul className="HostView-PlayersContainer">
				{Object.values(gameData.players).map((player) => (
					<li className="HostView-Player" key={player.id}>
						<div className="HostView-PlayerName">{player.name}</div>
					</li>
				))}
			</ul>
			{userIsJoined ? 'You’re in!' : <EscapeGameJoinForm />}
		</>
	);
}
