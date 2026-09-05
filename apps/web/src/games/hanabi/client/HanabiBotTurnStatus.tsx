import { HanabiGameData, HanabiStage } from '@hanabi/shared';
import { useRef, useState } from 'react';
import { useUserId } from '~/components/SocketContext';
import HanabiMenuButton from '~/games/hanabi/client/design-system/HanabiMenuButton';
import { useBotStatusData, useGameMessenger } from '~/games/hanabi/client/HanabiGameContext';

type BotStatusGameData = Pick<
	HanabiGameData,
	'bots' | 'players' | 'currentPlayerId' | 'stage' | 'finishedReason'
>;

export default function HanabiBotTurnStatus(): JSX.Element | null {
	const gameData = useBotStatusData();
	const turn = gameData.bots?.turn;
	return (
		<BotTurnStatusMessage
			key={`${gameData.currentPlayerId}:${turn?.playerId}:${turn?.opportunity ?? 'turn'}:${turn?.status}`}
			gameData={gameData}
		/>
	);
}

function BotTurnStatusMessage({ gameData }: { gameData: BotStatusGameData }): JSX.Element | null {
	const messenger = useGameMessenger();
	const userId = useUserId();
	const [pending, setPending] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const retryPending = useRef(false);
	const turn = gameData.bots?.turn;
	const player = turn ? gameData.players[turn.playerId] : undefined;
	const seatedHuman =
		!!userId && !!gameData.players[userId] && gameData.players[userId].kind !== 'bot';

	if (
		!turn ||
		turn.status === 'thinking' ||
		player?.kind !== 'bot' ||
		(gameData.currentPlayerId !== turn.playerId && turn.opportunity !== 'clue') ||
		gameData.stage !== HanabiStage.Playing ||
		gameData.finishedReason !== null
	) {
		return null;
	}

	const canRetry = seatedHuman && turn.status !== 'disabled' && turn.canRetry;
	const message =
		turn.message ??
		{
			error:
				turn.opportunity === 'clue'
					? 'The bot could not finish considering the clue. Play can continue.'
					: 'The bot could not finish its turn.',
			disabled: 'Bots are unavailable. Ask the server operator to enable them, or reset the game.',
			exhausted: 'This round has reached its bot limit. Reset the game to start a new round.',
		}[turn.status];

	const retry = async () => {
		if (!canRetry || retryPending.current) return;
		retryPending.current = true;
		setPending(true);
		setError(null);
		try {
			await messenger.retryBotTurn();
		} catch (retryError) {
			setError(retryError instanceof Error ? retryError.message : 'Could not retry the bot turn.');
		} finally {
			retryPending.current = false;
			setPending(false);
		}
	};

	return (
		<section
			aria-label={turn.opportunity === 'clue' ? 'Bot clue response paused' : 'Bot turn paused'}
			className="mx-auto mb-4 flex w-[calc(100%-32px)] max-w-[1660px] flex-wrap items-center justify-between gap-3 rounded-md border border-hanabi-coral/50 bg-hanabi-surface px-4 py-3 text-hanabi-text"
		>
			<div className="min-w-0 flex-1" role="status">
				<p className="text-lg font-medium">{player.name} is paused</p>
				<p className="text-base text-hanabi-text-muted">{message}</p>
				{error && (
					<p className="mt-1 text-base text-hanabi-coral-soft" role="alert">
						{error}
					</p>
				)}
			</div>
			{canRetry && (
				<HanabiMenuButton
					disabled={pending}
					label={pending ? 'Retrying…' : 'Retry'}
					onClick={() => void retry()}
				/>
			)}
		</section>
	);
}
