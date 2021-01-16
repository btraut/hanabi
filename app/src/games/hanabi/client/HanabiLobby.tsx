import { useSocket } from 'app/src/components/SocketContext';
import { useHanabiGame } from 'app/src/games/hanabi/client/HanabiContext';
import HanabiJoinForm from 'app/src/games/hanabi/client/HanabiJoinForm';
import HanabiMenuButton from 'app/src/games/hanabi/client/HanabiMenuButton';
import HanabiPlayerAvatar from 'app/src/games/hanabi/client/HanabiPlayerAvatar';
import { HANABI_MIN_PLAYERS } from 'app/src/games/hanabi/HanabiGameData';

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
		<div className="grid grid-flow-row gap-y-10">
			{userIsJoined && (
				<p className="max-w-screen-md bg-gray-400 font-bold text-lg text-center">
					<a className="inline-block px-5 py-3 text-blue-700 hover:text-blue-800" href={link}>
						{link}
					</a>
				</p>
			)}
			{players.length > 0 && (
				<div className="grid grid-flow-col gap-x-4 justify-center">
					{players.map((player) => (
						<HanabiPlayerAvatar key={player.id} player={player} />
					))}
				</div>
			)}
			{userIsJoined ? (
				<div className="grid grid-flow-col gap-x-4 justify-center">
					<HanabiMenuButton label="Leave" onClick={handleLeaveClick} />
					<HanabiMenuButton
						label="Start Game"
						onClick={handleStartClick}
						disabled={!enoughPlayers}
					/>
				</div>
			) : (
				<HanabiJoinForm />
			)}
		</div>
	);
}
