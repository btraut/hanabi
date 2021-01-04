import { useSocket } from 'app/src/components/SocketContext';
import { useEscapeGame } from 'app/src/games/escape/client/EscapeContext';
import EscapeJoinForm from 'app/src/games/escape/client/EscapeJoinForm';
import { MINIMUM_PLAYERS } from 'app/src/games/escape/EscapeRules';
import classnames from 'classnames';

declare const DOMAIN_BASE: string;

export default function EscapeLobby(): JSX.Element {
	const game = useEscapeGame();
	const { authSocketManager } = useSocket();

	if (!game || !authSocketManager.userId) {
		throw new Error('Must connect/join. This should never happen.');
	}

	const handleLeaveClick = async () => {
		await game.leave();
	};

	const handleStartClick = async () => {
		await game.start();
	};

	const userIsJoined = !!(
		authSocketManager.userId && game.gameData.players[authSocketManager.userId]
	);
	const enoughPlayers = Object.keys(game.gameData.players).length >= MINIMUM_PLAYERS;
	const title = userIsJoined
		? enoughPlayers
			? 'Ready to get started?'
			: 'Keep recruiting!'
		: 'C’mon in! Bring your friends.';
	const link = `${DOMAIN_BASE}/escape/${game.code}`;

	return (
		<>
			<h1 className="Escape-Subtitle">{title}</h1>
			<p className="Escape-Description">
				<a href={link}>{link}</a>
			</p>
			<ul className="Escape-PlayersContainer">
				{Object.values(game.gameData.players).map((player) => (
					<li
						className={classnames('Escape-Player', {
							'Escape-Player--Disconnected': !player.connected,
						})}
						key={player.id}
					>
						<img className="Escape-PlayerPicture" src="/images/user.svg" />
						<div className="Escape-PlayerName">{player.name}</div>
					</li>
				))}
			</ul>
			{userIsJoined ? (
				<div className="Escape-FormButtons">
					<button className="Escape-GameAction" onClick={handleLeaveClick}>
						Leave
					</button>
					<button
						disabled={!enoughPlayers}
						className="Escape-GameAction"
						onClick={handleStartClick}
					>
						Start Game
					</button>
				</div>
			) : (
				<EscapeJoinForm />
			)}
		</>
	);
}
