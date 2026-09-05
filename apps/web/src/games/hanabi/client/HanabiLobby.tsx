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
import { HANABI_MAX_PLAYERS, HANABI_MIN_PLAYERS, HanabiStage } from '@hanabi/shared';
import { useRef, useState } from 'react';

export default function HanabiLobby(): JSX.Element {
	const gameMessenger = useGameMessenger();
	const gameData = useGameData();
	const { code } = useHanabiGameContext();
	const userId = useUserId();
	const [botRequest, setBotRequest] = useState<string | null>(null);
	const [botError, setBotError] = useState<string | null>(null);
	const botRequestPending = useRef(false);

	const handleLeaveClick = () => {
		void gameMessenger.leave().catch((error: unknown) => {
			console.error('Could not leave the game:', error);
		});
	};

	const handleStartClick = () => {
		void gameMessenger.start().catch((error: unknown) => {
			console.error('Could not start the game:', error);
		});
	};

	const userIsJoined = !!(userId && gameData.players[userId]);
	const canManageBots =
		userIsJoined &&
		gameData.players[userId].kind !== 'bot' &&
		gameData.stage === HanabiStage.Setup &&
		gameData.bots?.canManage === true;
	const enoughPlayers =
		Object.keys(gameData.players).length >= (import.meta.env.DEV ? 1 : HANABI_MIN_PLAYERS);
	const link = `${window.location.origin}/${code}`;

	const players = Object.values(gameData.players);
	const lobbyFull = players.length >= HANABI_MAX_PLAYERS;

	const manageBot = async (playerId?: string) => {
		if (!canManageBots || botRequestPending.current) return;
		if (!playerId && (!gameData.bots?.available || lobbyFull)) return;
		botRequestPending.current = true;
		setBotRequest(playerId ?? 'add');
		setBotError(null);
		try {
			if (playerId) await gameMessenger.removeBot(playerId);
			else await gameMessenger.addBot();
		} catch (error) {
			setBotError(error instanceof Error ? error.message : 'Could not update the bot seats.');
		} finally {
			botRequestPending.current = false;
			setBotRequest(null);
		}
	};

	return (
		<div className="w-screen min-h-screen grid grid-flow-row gap-6 content-start">
			<HanabiHeader />
			<div className="grid w-full max-w-2xl gap-10 justify-self-center px-4 py-8 sm:p-10">
				{players.length > 0 && (
					<div
						className="flex flex-wrap items-start justify-center gap-x-6 gap-y-5"
						aria-label="Players"
					>
						{players.map((player) => (
							<HanabiPlayerAvatar
								key={player.id}
								player={player}
								onRemove={
									canManageBots && player.kind === 'bot'
										? () => void manageBot(player.id)
										: undefined
								}
								removeDisabled={botRequest !== null}
							/>
						))}
					</div>
				)}
				{userIsJoined && <HanabiCopyLinkButton link={link} />}
				{userIsJoined ? (
					<>
						<div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-[auto_auto] sm:gap-y-6">
							<div className="mt-2 text-lg font-bold text-white cursor-default select-none sm:justify-self-end">
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

							<div className="text-lg font-bold text-white cursor-default select-none sm:justify-self-end">
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
						<div className="grid gap-3">
							<div className="flex flex-wrap justify-center gap-4">
								<HanabiMenuButton
									label="Leave"
									onClick={handleLeaveClick}
									disabled={botRequest !== null}
								/>
								{canManageBots && (
									<HanabiMenuButton
										label={botRequest === 'add' ? 'Adding…' : 'Add bot'}
										onClick={() => void manageBot()}
										disabled={botRequest !== null || !gameData.bots?.available || lobbyFull}
										aria-describedby={
											!gameData.bots?.available || lobbyFull ? 'bot-availability' : undefined
										}
									/>
								)}
								<HanabiMenuButton
									label="Start game"
									onClick={handleStartClick}
									disabled={!enoughPlayers || botRequest !== null}
									variant="primary"
								/>
							</div>
							{canManageBots && (!gameData.bots?.available || lobbyFull) && (
								<p id="bot-availability" className="text-center text-base text-hanabi-text-muted">
									{!gameData.bots?.available
										? 'Bots are unavailable on this server.'
										: 'The lobby is full (5 players).'}
								</p>
							)}
							{botError && (
								<p role="alert" className="text-center text-base text-hanabi-coral-soft">
									{botError}
								</p>
							)}
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
