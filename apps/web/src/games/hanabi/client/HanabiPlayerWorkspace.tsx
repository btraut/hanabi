import { HanabiGameData, HanabiPlayer } from '@hanabi/shared';
import { HanabiTileHighlightTone } from '~/games/hanabi/client/HanabiHighlightContext';
import HanabiPlayerAvatar from '~/games/hanabi/client/HanabiPlayerAvatar';
import classNames from 'classnames';
import { ReactNode } from 'react';

interface WorkspaceProps {
	active: boolean;
	children: ReactNode;
	clueLabel?: string;
	clueTone?: HanabiTileHighlightTone;
	finished: boolean;
	isLocal: boolean;
	player: HanabiPlayer;
}

interface WorkspacesProps {
	clueHighlight?: {
		label: string;
		recipientId: string;
		tone: HanabiTileHighlightTone;
	};
	gameData: HanabiGameData;
	renderTileSurface: (playerId: string) => ReactNode;
	userId: string;
}

export function getHanabiPlayerDisplayOrder(
	turnOrder: readonly string[],
	userId: string,
): readonly string[] {
	const userIndex = turnOrder.indexOf(userId);
	if (userIndex <= 0) return turnOrder;
	return [...turnOrder.slice(userIndex), ...turnOrder.slice(0, userIndex)];
}

export const HANABI_PLAYER_ACCENTS = ['#638fd1', '#d66b5c', '#9278c4', '#65a879', '#d5ad61'];

export function getHanabiPlayerAccent(
	turnOrder: readonly string[],
	userId: string,
	playerId: string,
): string {
	const displayOrder = getHanabiPlayerDisplayOrder(turnOrder, userId);
	const playerIndex = Math.max(0, displayOrder.indexOf(playerId));
	return HANABI_PLAYER_ACCENTS[playerIndex % HANABI_PLAYER_ACCENTS.length];
}

export function HanabiDesktopPlayerWorkspaces({
	clueHighlight,
	gameData,
	renderTileSurface,
	userId,
}: WorkspacesProps): JSX.Element {
	const finished = gameData.finishedReason !== null;
	const displayOrder = getHanabiPlayerDisplayOrder(gameData.turnOrder, userId);

	return (
		<div aria-label="Player workspaces" className="hanabi-player-workspaces grid gap-1.5">
			{displayOrder.map((playerId) => (
				<HanabiPlayerWorkspace
					active={!finished && gameData.currentPlayerId === playerId}
					clueLabel={clueHighlight?.recipientId === playerId ? clueHighlight.label : undefined}
					clueTone={clueHighlight?.recipientId === playerId ? clueHighlight.tone : undefined}
					finished={finished}
					isLocal={userId === playerId}
					key={playerId}
					player={gameData.players[playerId]}
				>
					{renderTileSurface(playerId)}
				</HanabiPlayerWorkspace>
			))}
		</div>
	);
}

export default function HanabiPlayerWorkspace({
	active,
	children,
	clueLabel,
	clueTone = 'number',
	finished,
	isLocal,
	player,
}: WorkspaceProps): JSX.Element {
	return (
		<section
			aria-label={`${player.name}${isLocal ? ', you' : ''}${active ? ', playing' : ''}`}
			className={classNames(
				'hanabi-player-workspace grid h-[186px] w-full min-w-0 grid-cols-[80px_minmax(0,1fr)] overflow-hidden rounded-md border bg-hanabi-surface shadow-[0_10px_24px_rgb(0_0_0_/_16%)]',
				{
					'border-hanabi-border': !active,
					'border-hanabi-coral shadow-[0_0_0_1px_rgb(255_114_95_/_22%),0_14px_34px_rgb(0_0_0_/_26%)]':
						active,
					'opacity-70': !player.connected,
				},
			)}
		>
			<div
				className={classNames(
					'hanabi-player-identity flex min-w-0 flex-col items-center justify-start gap-1.5 border-r px-1.5 pt-3 text-center',
					active
						? 'border-hanabi-coral/55 bg-hanabi-coral/14'
						: 'border-hanabi-border bg-hanabi-table/35',
				)}
			>
				<HanabiPlayerAvatar player={player} showName={false} size="sm" />
				<p
					className="hanabi-player-name w-full truncate text-[17px] font-medium leading-6 text-hanabi-text"
					title={player.name}
				>
					{isLocal ? 'You' : player.name}
				</p>
				<div className="flex flex-wrap items-center justify-center gap-1.5">
					{active && !finished && (
						<span className="rounded-md border border-hanabi-coral-soft/45 bg-hanabi-coral px-2 py-0.5 text-[12px] font-medium leading-5 text-white shadow-[0_2px_7px_rgb(0_0_0_/_22%)]">
							Playing
						</span>
					)}
					{!player.connected && (
						<span className="text-[12px] font-medium leading-5 text-hanabi-text-muted">
							Offline
						</span>
					)}
					{clueLabel && (
						<span
							aria-live="polite"
							className={`hanabi-clue-pill hanabi-clue-pill-${clueTone} rounded-md border px-2 py-1 text-xs font-semibold leading-4`}
						>
							{clueLabel} clue
						</span>
					)}
				</div>
			</div>
			<div className="min-w-0 overflow-hidden bg-hanabi-table/35">{children}</div>
		</section>
	);
}
