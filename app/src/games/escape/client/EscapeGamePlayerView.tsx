import { useSocketManager } from 'app/src/components/SocketManagerContext';
import EscapeGameJoinForm from 'app/src/games/escape/client/EscapeGameJoinForm';
import { useEscapeGameManager } from 'app/src/games/escape/client/EscapeGameManagerContext';

export default function EscapeGamePlayerView(): JSX.Element {
	const gameManager = useEscapeGameManager();
	const socketManager = useSocketManager();

	const gameData = gameManager.gameData;

	const handleLeaveClick = async () => {
		await gameManager.leaveGame();
	};

	if (!gameData) {
		return <h1 className="EscapeGame-Subtitle">Loading…</h1>;
	}

	const userIsJoined = !!(socketManager.userId && gameData.players[socketManager.userId]);
	const readyToStart = userIsJoined && Object.keys(gameData.players).length > 1;
	const title = userIsJoined
		? readyToStart
			? 'Ready to get started?'
			: 'Keep recruiting!'
		: 'C’mon in! Bring your friends.';

	return (
		<>
			<h1 className="EscapeGame-Subtitle">{title}</h1>
			<ul className="EscapeGame-PlayersContainer">
				{Object.values(gameData.players).map((player) => (
					<li className="EscapeGame-Player" key={player.id}>
						<img className="EscapeGame-PlayerPicture" src="/images/user.svg" />
						<div className="EscapeGame-PlayerName">{player.name}</div>
					</li>
				))}
			</ul>
			{!userIsJoined && <EscapeGameJoinForm />}
			<div className="EscapeGame-FormButtons">
				{userIsJoined && (
					<button className="EscapeGame-GameAction" onClick={handleLeaveClick}>
						Leave
					</button>
				)}
				{readyToStart && <button className="EscapeGame-GameAction">Start Game</button>}
			</div>
		</>
	);
}
