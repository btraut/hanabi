import Star from '~/games/hanabi/client/icons/Star';
import { HANABI_TILE_BACK_PATH } from '~/games/hanabi/client/HanabiArtwork';
import HanabiHeaderMenuButton from '~/games/hanabi/client/HanabiHeaderMenuButton';
import { getHanabiMaxScore, getHanabiScore, HanabiGameData, HanabiStage } from '@hanabi/shared';
import { CSSProperties } from 'react';

interface Props {
	gameData: HanabiGameData;
	userId: string;
	turnLabel?: string;
	showGameMenu?: boolean;
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
		turnLabel = `${currentPlayer?.name || 'Another player'}'s turn`;
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

export default function HanabiDesktopStatus({
	gameData,
	userId,
	turnLabel,
	showGameMenu = true,
}: Props): JSX.Element {
	const status = getHanabiDesktopStatusData(gameData, userId);

	return (
		<div className="hanabi-status-regions">
			<section
				aria-label="Current turn"
				className="hanabi-turn-banner flex min-w-0 items-center gap-4 overflow-hidden rounded-md border border-hanabi-coral bg-[linear-gradient(130deg,#d95445,#df705d)] px-5 shadow-[0_12px_30px_rgb(0_0_0_/_22%)]"
			>
				<span
					aria-hidden="true"
					className="size-9 shrink-0 rounded-full border-[3px] border-white shadow-[0_0_16px_rgb(255_255_255_/_18%)]"
				/>
				<p className="hanabi-turn-label truncate text-[36px] font-medium tracking-[-0.025em] text-white">
					{turnLabel ?? status.turnLabel}
				</p>
			</section>
			{showGameMenu && (
				<div className="hanabi-mobile-game-menu">
					<HanabiHeaderMenuButton variant="game" />
				</div>
			)}
			<section
				aria-label="Game status"
				className="hanabi-panel hanabi-desktop-status min-w-0 overflow-hidden rounded-lg"
			>
				<dl className="grid h-full grid-cols-4">
					<StatusItem
						icon={<Star size={38} />}
						label="Score"
						tone="text-hanabi-white"
						value={`${status.score}/${status.maxScore}`}
					/>
					<StatusItem
						icon={<DeckStatusIcon />}
						label="Deck"
						tone="text-hanabi-ivory-muted"
						value={status.deck}
					/>
					<StatusItem
						icon={<ClueStatusIcon />}
						label="Clues"
						tone="text-[#638fd1]"
						value={status.clues}
					/>
					<StatusItem
						icon={<LifeStatusIcon />}
						label="Lives"
						tone="text-[#df6756]"
						value={status.lives}
					/>
				</dl>
			</section>
		</div>
	);
}

function DeckStatusIcon(): JSX.Element {
	return (
		<span
			aria-hidden="true"
			className="hanabi-status-deck-icon"
			data-status-icon="deck"
			style={
				{
					'--hanabi-status-deck-art': `url(${HANABI_TILE_BACK_PATH})`,
				} as CSSProperties
			}
		>
			<span className="hanabi-status-deck-face" />
		</span>
	);
}

function ClueStatusIcon(): JSX.Element {
	return (
		<span
			aria-hidden="true"
			className="hanabi-clue-token hanabi-status-clue-icon"
			data-status-icon="clues"
		/>
	);
}

function LifeStatusIcon(): JSX.Element {
	return (
		<svg
			aria-hidden="true"
			className="hanabi-status-life-icon"
			data-status-icon="lives"
			viewBox="0 0 90 82"
		>
			<defs>
				<linearGradient id="hanabi-status-life-gradient" x1="25%" x2="78%" y1="10%" y2="90%">
					<stop offset="0%" stopColor="#ff8078" />
					<stop offset="52%" stopColor="#ed5f58" />
					<stop offset="100%" stopColor="#b73735" />
				</linearGradient>
			</defs>
			<path
				d="M45 81.326 42.919 79.965C41.17 78.821.09 51.675.09 27.196.09 9.784 12.463.675 24.685.675 32.498.675 39.816 4.321 44.997 10.622 50.161 4.332 57.49.675 65.316.675 77.538.675 89.91 9.785 89.91 27.196 89.91 51.675 48.83 78.821 47.082 79.965L45 81.326Z"
				fill="url(#hanabi-status-life-gradient)"
				paintOrder="stroke"
				stroke="#8d2d32"
				strokeWidth="4"
			/>
			<path
				d="M16 17c5-8 15-9 22-2"
				fill="none"
				stroke="white"
				strokeLinecap="round"
				strokeWidth="4"
				opacity=".24"
			/>
		</svg>
	);
}

function StatusItem({
	icon,
	label,
	tone,
	value,
}: {
	icon: JSX.Element;
	label: string;
	tone: string;
	value: number | string;
}): JSX.Element {
	return (
		<div className="hanabi-status-item relative flex min-w-0 items-center justify-center gap-2.5 px-3 py-2.5 before:absolute before:bottom-3 before:left-0 before:top-3 before:w-px before:bg-hanabi-border first:before:hidden">
			<span className={tone}>{icon}</span>
			<div className="min-w-0">
				<dt className="hanabi-status-label text-[17px] font-medium text-hanabi-text-muted">
					{label}
				</dt>
				<dd className="hanabi-status-value text-[29px] font-medium leading-none tabular-nums text-hanabi-text">
					{value}
				</dd>
			</div>
		</div>
	);
}
