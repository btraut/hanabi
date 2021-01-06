import { useSocket } from 'app/src/components/SocketContext';
import { useHanabiGame } from 'app/src/games/hanabi/client/HanabiContext';
import HanabiJoinForm from 'app/src/games/hanabi/client/HanabiJoinForm';
import { HANABI_MIN_PLAYERS } from 'app/src/games/hanabi/HanabiGameData';
import classnames from 'classnames';

declare const DOMAIN_BASE: string;

export default function HanabiLobby(): JSX.Element {
	const game = useHanabiGame();
	const { userId } = useSocket();

	if (!game || !userId) {
		throw new Error('Must connect/join. This should never happen.');
	}

	const handleLeaveClick = async () => {
		await game.leave();
	};

	const handleStartClick = async () => {
		await game.start();
	};

	const userIsJoined = !!(userId && game.gameData.players[userId]);
	const enoughPlayers = Object.keys(game.gameData.players).length >= HANABI_MIN_PLAYERS;
	const title = userIsJoined
		? enoughPlayers
			? 'Ready to get started?'
			: 'Keep recruiting!'
		: 'C’mon in! Bring your friends.';
	const link = `${DOMAIN_BASE}/hanabi/${game.code}`;

	return (
		<>
			<h1 className="Hanabi-Subtitle">{title}</h1>
			<p className="Hanabi-Description">
				<a href={link}>{link}</a>
			</p>
			<ul className="Hanabi-PlayersContainer">
				{Object.values(game.gameData.players).map((player) => (
					<li
						className={classnames('Hanabi-Player', {
							'Hanabi-Player--Disconnected': !player.connected,
						})}
						key={player.id}
					>
						<img className="Hanabi-PlayerPicture" src="/images/user.svg" />
						<div className="Hanabi-PlayerName">{player.name}</div>
					</li>
				))}
			</ul>
			{userIsJoined ? (
				<div className="Hanabi-FormButtons">
					<button className="Hanabi-GameAction" onClick={handleLeaveClick}>
						Leave
					</button>
					<button
						disabled={!enoughPlayers}
						className="Hanabi-GameAction"
						onClick={handleStartClick}
					>
						Start Game
					</button>
				</div>
			) : (
				<HanabiJoinForm />
			)}
		</>
	);
}
