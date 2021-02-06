import { useUserId } from 'app/src/components/SocketContext';
import { useHanabiGame } from 'app/src/games/hanabi/client/HanabiContext';
import HanabiJoinForm from 'app/src/games/hanabi/client/HanabiJoinForm';
import HanabiMenuButton from 'app/src/games/hanabi/client/HanabiMenuButton';
import HanabiPlayerAvatar from 'app/src/games/hanabi/client/HanabiPlayerAvatar';
import { HANABI_MIN_PLAYERS } from 'app/src/games/hanabi/HanabiGameData';
import { useRef, useState } from 'react';

declare const DOMAIN_BASE: string;

export default function HanabiLobby(): JSX.Element {
	const game = useHanabiGame();
	const userId = useUserId();

	const handleLeaveClick = async () => {
		await game.leave();
	};

	const handleStartClick = async () => {
		await game.start();
	};

	const copyButtonRef = useRef<HTMLButtonElement | null>(null);
	const [showCopiedButton, setShowCopiedButton] = useState(false);
	const showCopiedButtonTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
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

		if (!showCopiedButtonTimeoutRef.current) {
			showCopiedButtonTimeoutRef.current = setTimeout(() => {
				setShowCopiedButton(false);
			}, 3000);
			showCopiedButtonTimeoutRef.current = undefined;
		}

		copyButtonRef.current?.focus();
	};

	const userIsJoined = !!(userId && game.gameData.players[userId]);
	const enoughPlayers = Object.keys(game.gameData.players).length >= HANABI_MIN_PLAYERS;
	const domainBase = typeof window === 'undefined' ? DOMAIN_BASE : window.location.origin;
	const link = `${domainBase}/${game.code}`;

	const players = Object.values(game.gameData.players);

	return (
		<div className="w-screen min-h-screen p-20 grid grid-flow-row gap-10 content-center justify-center">
			<h1 className="mb-10 text-8xl italic text-white text-center text-shadow">Hanabi</h1>
			{userIsJoined && (
				<button
					className="outline-none grid grid-flow-col items-center max-w-screen-md bg-gray-300 overflow-hidden rounded-lg font-bold text-blue-700 hover:text-blue-800 text-lg"
					onClick={handleLinkClick}
					ref={copyButtonRef}
				>
					<div className="inline-block px-5 text-center">{link}</div>
					<div className="text-white bg-gray-800 px-5 py-3 w-28">
						{showCopiedButton ? 'Copied!' : 'Copy'}
					</div>
				</button>
			)}
			{players.length > 0 && (
				<div className="grid grid-flow-col gap-x-6 justify-center">
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
