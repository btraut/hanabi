import { useSocket } from 'app/src/components/SocketContext';
import { useHanabiGame } from 'app/src/games/hanabi/client/HanabiContext';
import HanabiJoinForm from 'app/src/games/hanabi/client/HanabiJoinForm';
import HanabiMenuButton from 'app/src/games/hanabi/client/HanabiMenuButton';
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
	const link = `${DOMAIN_BASE}/hanabi/${game.code}`;

	const players = Object.values(game.gameData.players);

	return (
		<>
			<p className="max-w-screen-md bg-gray-400 font-bold text-lg text-center">
				<a className="inline-block px-5 py-3 text-blue-700 hover:text-blue-800" href={link}>
					{link}
				</a>
			</p>
			<ul className="my-8 flex justify-center">
				{players.map((player) => (
					<li
						className={classnames('m-4 mw-30', {
							'opacity-40': !player.connected,
						})}
						key={player.id}
					>
						<img className="block w-30 h-30 mb-4" src="/images/user-white.svg" />
						<div className="text-lg font-bold truncate text-white text-center">{player.name}</div>
					</li>
				))}
			</ul>
			{userIsJoined ? (
				<div className="flex justify-center">
					<div className="mx-2">
						<HanabiMenuButton label="Leave" onClick={handleLeaveClick} />
					</div>
					<div className="mx-2">
						<HanabiMenuButton
							label="Start Game"
							onClick={handleStartClick}
							disabled={!enoughPlayers}
						/>
					</div>
				</div>
			) : (
				<HanabiJoinForm />
			)}
		</>
	);
}
