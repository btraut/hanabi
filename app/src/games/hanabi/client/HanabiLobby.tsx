import { useSocket } from 'app/src/components/SocketContext';
import { useHanabiGame } from 'app/src/games/hanabi/client/HanabiContext';
import HanabiJoinForm from 'app/src/games/hanabi/client/HanabiJoinForm';
import HanabiMenuButton from 'app/src/games/hanabi/client/HanabiMenuButton';
import HanabiPlayerAvatar from 'app/src/games/hanabi/client/HanabiPlayerAvatar';
import { HANABI_MIN_PLAYERS } from 'app/src/games/hanabi/HanabiGameData';
import { useState } from 'react';

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

	const [showCopiedButton, setShowCopiedButton] = useState(false);
	const handleLinkClick = () => {
		const textArea = document.createElement('textarea');
		textArea.style.width = '1px';
		textArea.style.height = '1px';
		textArea.style.opacity = '0';
		textArea.style.position = 'absolute';
		textArea.value = link;
		document.body.append(textArea);
		textArea.select();
		document.execCommand('copy');
		document.body.removeChild(textArea);

		setShowCopiedButton(true);
	};

	const userIsJoined = !!(userId && game.gameData.players[userId]);
	const enoughPlayers = Object.keys(game.gameData.players).length >= HANABI_MIN_PLAYERS;
	const domainBase = typeof window === 'undefined' ? DOMAIN_BASE : window.location.origin;
	const link = `${domainBase}/hanabi/${game.code}`;

	const players = Object.values(game.gameData.players);

	return (
		<div className="grid grid-flow-row gap-y-10">
			{userIsJoined && (
				<div className="max-w-screen-md bg-gray-300 text-lg text-center grid grid-flow-col overflow-hidden rounded-lg">
					<button onClick={handleLinkClick} className="outline-none">
						<span className="inline-block px-5 py-3 font-bold text-blue-700 hover:text-blue-800">
							{link}
						</span>
					</button>
					{showCopiedButton && (
						<div className="text-white font-bold bg-gray-800 px-5 py-3">Copied!</div>
					)}
				</div>
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
