import { useUserId } from '~/components/SocketContext';
import HanabiMenuButton from '~/games/hanabi/client/design-system/HanabiMenuButton';
import HanabiChooseRuleSetForm from '~/games/hanabi/client/HanabiChooseRuleSetForm';
import HanabiCopyLinkButton from '~/games/hanabi/client/HanabiCopyLinkButton';
import {
	useGameData,
	useGameMessenger,
	useHanabiGameContext,
} from '~/games/hanabi/client/HanabiGameContext';
import HanabiHeader from '~/games/hanabi/client/HanabiHeader';
import HanabiJoinForm from '~/games/hanabi/client/HanabiJoinForm';
import HanabiLobbyGameOptionsForm from '~/games/hanabi/client/HanabiLobbyGameOptionsForm';
import HanabiPlayerAvatar from '~/games/hanabi/client/HanabiPlayerAvatar';
import { HANABI_MIN_PLAYERS } from '@hanabi/shared';

declare const DOMAIN_BASE: string;
declare const NODE_ENV: string;

export default function HanabiLobby(): JSX.Element {
	const gameMessenger = useGameMessenger();
	const gameData = useGameData();
	const { code } = useHanabiGameContext();
	const userId = useUserId();

	const handleLeaveClick = async () => {
		await gameMessenger.leave();
	};

	const handleStartClick = async () => {
		await gameMessenger.start();
	};

	const userIsJoined = !!(userId && gameData.players[userId]);
	const enoughPlayers =
		Object.keys(gameData.players).length >= (NODE_ENV === 'development' ? 1 : HANABI_MIN_PLAYERS);
	const domainBase = typeof window === 'undefined' ? DOMAIN_BASE : window.location.origin;
	const link = `${domainBase}/${code}`;

	const players = Object.values(gameData.players);

	return (
		<div className="w-screen min-h-screen grid grid-flow-row gap-6 content-start">
			<HanabiHeader />
			<div className="grid gap-10 justify-content-center justify-center p-10">
				{players.length > 0 && (
					<div className="grid grid-flow-col gap-x-6 justify-center">
						{players.map((player) => (
							<HanabiPlayerAvatar key={player.id} player={player} />
						))}
					</div>
				)}
				{userIsJoined && <HanabiCopyLinkButton link={link} />}
				{userIsJoined ? (
					<>
						<div className="grid gap-x-4 gap-y-6" style={{ gridTemplateColumns: 'auto auto' }}>
							<div className="mt-2 text-lg font-bold truncate text-center text-white cursor-default select-none justify-self-end">
								Game Rules:
							</div>
							<div className="justify-self-start grid gap-3">
								<HanabiChooseRuleSetForm ruleSet={gameData.ruleSet} />
								<HanabiLobbyGameOptionsForm
									checked={gameData.criticalGameOver}
									label="Discarding a critical tile ends the game"
									settingsKey="criticalGameOver"
								/>
							</div>

							<div className="text-lg font-bold truncate text-center text-white cursor-default select-none justify-self-end">
								Advanced Features:
							</div>
							<div className="justify-self-start grid gap-2">
								<HanabiLobbyGameOptionsForm
									checked={gameData.allowDragging}
									label="Allow reordering of tiles"
									settingsKey="allowDragging"
								/>
								<HanabiLobbyGameOptionsForm
									checked={gameData.showNotes}
									label="Show notes on tiles"
									settingsKey="showNotes"
								/>
							</div>
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
			<div id="portal" />
		</div>
	);
}
