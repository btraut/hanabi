import { useSocketManager } from 'app/src/components/SocketManagerContext';
import { useEscapeGame } from 'app/src/games/escape/client/EscapeGameContext';
import EscapeGameJoinForm from 'app/src/games/escape/client/EscapeGameJoinForm';
import { MINIMUM_PLAYERS } from 'app/src/games/escape/EscapeGameRules';
import classnames from 'classnames';

declare const DOMAIN_BASE: string;

export default function EscapeGameLobby(): JSX.Element {
	const socketManager = useSocketManager();

	const game = useEscapeGame();
	if (!game) {
		throw new Error('Cannot render with empty game. This should never happen.');
	}

	const handleLeaveClick = async () => {
		await game.leave();
	};

	const handleStartClick = async () => {
		await game.start();
	};

	const userIsJoined = !!(socketManager.userId && game.gameData.players[socketManager.userId]);
	const enoughPlayers = Object.keys(game.gameData.players).length >= MINIMUM_PLAYERS;
	const title = userIsJoined
		? enoughPlayers
			? 'Ready to get started?'
			: 'Keep recruiting!'
		: 'C’mon in! Bring your friends.';
	const link = `${DOMAIN_BASE}/escape/${game.code}`;

	return (
		<>
			<h1 className="EscapeGame-Subtitle">{title}</h1>
			<p className="EscapeGame-Description">
				<a href={link}>{link}</a>
			</p>
			<ul className="EscapeGame-PlayersContainer">
				{Object.values(game.gameData.players).map((player) => (
					<li
						className={classnames('EscapeGame-Player', {
							'EscapeGame-Player--Disconnected': !player.connected,
						})}
						key={player.id}
					>
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
