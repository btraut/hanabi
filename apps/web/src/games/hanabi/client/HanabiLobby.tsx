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
import { useRememberHanabiLobbySettings } from '~/games/hanabi/client/HanabiLobbySettings';
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
	useRememberHanabiLobbySettings(gameData, userIsJoined);
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
		<div className="hanabi-lobby w-screen min-h-screen grid grid-flow-row content-start">
			<HanabiHeader />
			<div className="grid w-full max-w-[560px] gap-[22px] justify-self-center px-4 pt-5 pb-6">
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
						{canManageBots && gameData.bots?.available && (
							<button
								type="button"
								className="hanabi-lobby-add-bot"
								onClick={() => void manageBot()}
								disabled={botRequest !== null || !gameData.bots?.available || lobbyFull}
								aria-describedby={lobbyFull ? 'bot-availability' : undefined}
							>
								<span className="hanabi-lobby-add-bot-icon" aria-hidden="true">
									<svg width="56" height="56" viewBox="0 0 56 56" fill="currentColor">
										<path
											fillRule="evenodd"
											d="M28 0a28 28 0 1 0 0 56a28 28 0 1 0 0-56ZM25 17h6v8h8v6h-8v8h-6v-8h-8v-6h8Z"
										/>
									</svg>
								</span>
								<span>{botRequest === 'add' ? 'Adding…' : 'Add bot'}</span>
							</button>
						)}
					</div>
				)}
				{canManageBots && lobbyFull && (
					<p id="bot-availability" className="text-center text-base text-hanabi-text-muted">
						The lobby is full (5 players).
					</p>
				)}
				{botError && (
					<p role="alert" className="text-center text-base text-hanabi-coral-soft">
						{botError}
					</p>
				)}

				{userIsJoined && (
					<div className="hanabi-lobby-invite">
						<HanabiCopyLinkButton link={link} />
					</div>
				)}
				{userIsJoined ? (
					<>
						<div className="grid min-w-0 gap-[22px]">
							<HanabiChooseRuleSetForm ruleSet={gameData.ruleSet} />
							<fieldset className="min-w-0">
								<legend className="mb-3 text-lg font-bold text-white">Advanced Features</legend>
								<div className="grid gap-3">
									<HanabiLobbyGameOptionsForm
										checked={gameData.criticalGameOver}
										label="Discarding a critical tile ends the game"
										settingsKey="criticalGameOver"
									/>
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
							</fieldset>
						</div>
						<div className="grid gap-3">
							<div className="flex flex-wrap justify-center gap-2.5">
								<HanabiMenuButton
									label="Leave"
									onClick={handleLeaveClick}
									disabled={botRequest !== null}
								/>

								<HanabiMenuButton
									label="Start game"
									onClick={handleStartClick}
									disabled={!enoughPlayers || botRequest !== null}
									variant="primary"
								/>
							</div>
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
