import CardStack from '~/games/hanabi/client/icons/CardStack';
import Heart from '~/games/hanabi/client/icons/Heart';
import Star from '~/games/hanabi/client/icons/Star';
import { getHanabiMaxScore, getHanabiScore, HanabiGameData, HanabiStage } from '@hanabi/shared';

interface Props {
	gameData: HanabiGameData;
	userId: string;
}

export interface HanabiDesktopStatusData {
	deck: number;
	clues: number;
	lives: number;
	maxScore: number;
	score: number;
	turnLabel: string;
}

export function getHanabiDesktopStatusData(
	gameData: HanabiGameData,
	userId: string,
): HanabiDesktopStatusData {
	let turnLabel = 'Preparing the next turn';
	if (gameData.stage === HanabiStage.Finished || gameData.finishedReason !== null) {
		turnLabel = 'Game finished';
	} else if (gameData.currentPlayerId === userId) {
		turnLabel = 'Your turn';
	} else if (gameData.currentPlayerId) {
		const currentPlayer = gameData.players[gameData.currentPlayerId];
		turnLabel = `${currentPlayer?.name || 'Another player'}’s turn`;
		if (currentPlayer && !currentPlayer.connected) turnLabel += ' · disconnected';
	}

	if (gameData.remainingTurns !== null && gameData.stage === HanabiStage.Playing) {
		turnLabel += ` · ${gameData.remainingTurns} ${gameData.remainingTurns === 1 ? 'turn' : 'turns'} left`;
	}

	return {
		deck: gameData.remainingTiles.length,
		clues: gameData.clues,
		lives: gameData.lives,
		maxScore: getHanabiMaxScore(gameData.ruleSet),
		score: getHanabiScore(gameData),
		turnLabel,
	};
}

export default function HanabiDesktopStatus({ gameData, userId }: Props): JSX.Element {
	const status = getHanabiDesktopStatusData(gameData, userId);

	return (
		<section aria-label="Game status" className="hanabi-panel overflow-hidden rounded-xl">
			<div className="flex min-h-12 items-center gap-3 border-b border-hanabi-border px-4">
				<span
					aria-hidden="true"
					className="size-2 rounded-full bg-hanabi-coral shadow-[0_0_12px_var(--color-hanabi-coral)]"
				/>
				<p className="text-sm font-semibold text-hanabi-text">{status.turnLabel}</p>
			</div>
			<dl className="grid grid-cols-4 divide-x divide-hanabi-border">
				<StatusItem
					icon={<Star size={17} />}
					label="Score"
					value={`${status.score}/${status.maxScore}`}
				/>
				<StatusItem icon={<CardStack size={18} />} label="Deck" value={status.deck} />
				<StatusItem
					icon={
						<span aria-hidden="true" className="size-3.5 rounded-full border-2 border-current" />
					}
					label="Clues"
					value={status.clues}
				/>
				<StatusItem
					icon={<Heart color="currentColor" size={17} />}
					label="Lives"
					value={status.lives}
				/>
			</dl>
		</section>
	);
}

function StatusItem({
	icon,
	label,
	value,
}: {
	icon: JSX.Element;
	label: string;
	value: number | string;
}): JSX.Element {
	return (
		<div className="flex min-w-0 items-center justify-center gap-2 px-3 py-2.5">
			<span className="text-hanabi-text-muted">{icon}</span>
			<div className="min-w-0">
				<dt className="text-[10px] font-semibold uppercase tracking-[0.16em] text-hanabi-text-muted">
					{label}
				</dt>
				<dd className="text-sm font-semibold tabular-nums text-hanabi-text">{value}</dd>
			</div>
		</div>
	);
}
