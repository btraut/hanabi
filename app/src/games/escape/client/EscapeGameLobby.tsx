import { useSocketManager } from 'app/src/components/SocketManagerContext';
import EscapeGameJoinForm from 'app/src/games/escape/client/EscapeGameJoinForm';
import { useEscapeGameManager } from 'app/src/games/escape/client/EscapeGameManagerContext';
import { MINIMUM_PLAYERS } from 'app/src/games/escape/EscapeGameRules';

declare const DOMAIN_BASE: string;

export default function EscapeGamePlayerView(): JSX.Element {
	const gameManager = useEscapeGameManager();
	const socketManager = useSocketManager();

	const gameData = gameManager.gameData;
	if (!gameData) {
		throw new Error('Cannot render with empty game data. This should never happen.');
	}

	const handleLeaveClick = async () => {
		await gameManager.leave();
	};

	const handleStartClick = async () => {
		await gameManager.start();
	};

	const userIsJoined = !!(socketManager.userId && gameData.players[socketManager.userId]);
	const enoughPlayers = Object.keys(gameData.players).length >= MINIMUM_PLAYERS;
	const title = userIsJoined
		? enoughPlayers
			? 'Ready to get started?'
			: 'Keep recruiting!'
		: 'C’mon in! Bring your friends.';
	const link = `${DOMAIN_BASE}/escape/${gameManager.code}`;

	return (
		<>
			<h1 className="EscapeGame-Subtitle">{title}</h1>
			<p className="EscapeGame-Description">
				<a href={link}>{link}</a>
			</p>
			<ul className="EscapeGame-PlayersContainer">
				{Object.values(gameData.players).map((player) => (
					<li className="EscapeGame-Player" key={player.id}>
						<img className="EscapeGame-PlayerPicture" src="/images/user.svg" />
						<div className="EscapeGame-PlayerName">{player.name}</div>
					</li>
				))}
			</ul>
			{userIsJoined ? (
				<div className="EscapeGame-FormButtons">
					<button className="EscapeGame-GameAction" onClick={handleLeaveClick}>
						Leave
					</button>
					<button
						disabled={!enoughPlayers}
						className="EscapeGame-GameAction"
						onClick={handleStartClick}
					>
						Start Game
					</button>
				</div>
			) : (
				<EscapeGameJoinForm />
			)}
		</>
	);
}
