import { useUserId } from 'app/src/components/SocketContext';
import HanabiMenuButton from 'app/src/games/hanabi/client/design-system/HanabiMenuButton';
import HanabiAllowDraggingForm from 'app/src/games/hanabi/client/HanabiAllowDraggingForm';
import HanabiChooseRuleSetForm from 'app/src/games/hanabi/client/HanabiChooseRuleSetForm';
import { useHanabiGame } from 'app/src/games/hanabi/client/HanabiContext';
import HanabiCopyLinkButton from 'app/src/games/hanabi/client/HanabiCopyLinkButton';
import HanabiJoinForm from 'app/src/games/hanabi/client/HanabiJoinForm';
import HanabiPlayerAvatar from 'app/src/games/hanabi/client/HanabiPlayerAvatar';
import HanabiShowNotesForm from 'app/src/games/hanabi/client/HanabiShowNotesForm';
import { HANABI_MIN_PLAYERS } from 'app/src/games/hanabi/HanabiGameData';

declare const DOMAIN_BASE: string;
declare const NODE_ENV: string;

export default function HanabiLobby(): JSX.Element {
	const game = useHanabiGame();
	const userId = useUserId();

	const handleLeaveClick = async () => {
		await game.leave();
	};

	const handleStartClick = async () => {
		await game.start();
	};

	const userIsJoined = !!(userId && game.gameData.players[userId]);
	const enoughPlayers =
		Object.keys(game.gameData.players).length >=
		(NODE_ENV === 'development' ? 1 : HANABI_MIN_PLAYERS);
	const domainBase = typeof window === 'undefined' ? DOMAIN_BASE : window.location.origin;
	const link = `${domainBase}/${game.code}`;

	const players = Object.values(game.gameData.players);

	return (
		<div className="w-screen min-h-screen p-20 grid grid-flow-row gap-10 content-center justify-center">
			<h1 className="mb-10 text-8xl italic text-white text-center text-shadow">Hanabi</h1>
			{userIsJoined && <HanabiCopyLinkButton link={link} />}
			{players.length > 0 && (
				<div className="grid grid-flow-col gap-x-6 justify-center">
					{players.map((player) => (
						<HanabiPlayerAvatar key={player.id} player={player} />
					))}
				</div>
			)}
			{userIsJoined ? (
				<>
					<div className="grid grid-flow-row gap-2">
						<HanabiChooseRuleSetForm ruleSet={game.gameData.ruleSet} />
						<HanabiAllowDraggingForm allowDragging={game.gameData.allowDragging} />
						<HanabiShowNotesForm showNotes={game.gameData.showNotes} />
					</div>
					<div className="grid grid-flow-col gap-x-4 justify-center">
						<HanabiMenuButton label="Leave" onClick={handleLeaveClick} />
						<HanabiMenuButton
							label="Start Game"
							onClick={handleStartClick}
							disabled={!enoughPlayers}
						/>
					</div>
				</>
			) : (
				<HanabiJoinForm />
			)}
		</div>
	);
}
