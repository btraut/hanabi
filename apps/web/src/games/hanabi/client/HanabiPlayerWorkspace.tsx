import { HanabiGameData, HanabiPlayer, HanabiStage } from '@hanabi/shared';
import HanabiPlayerAvatar from '~/games/hanabi/client/HanabiPlayerAvatar';
import classNames from 'classnames';
import { ComponentType, ReactNode } from 'react';

export interface HanabiPlayerWorkspaceProps {
	active: boolean;
	children: ReactNode;
	finished: boolean;
	isLocal: boolean;
	player: HanabiPlayer;
	review?: boolean;
	reviewPerspective?: boolean;
	thinking?: boolean;
	thinkingLabel?: string;
}

interface WorkspacesProps {
	gameData: HanabiGameData;
	renderTileSurface: (playerId: string) => ReactNode;
	userId: string;
	workspaceComponent?: ComponentType<HanabiPlayerWorkspaceProps>;
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
	gameData,
	renderTileSurface,
	userId,
	workspaceComponent: Workspace = HanabiPlayerWorkspace,
}: WorkspacesProps): JSX.Element {
	const finished = gameData.finishedReason !== null;
	const displayOrder = getHanabiPlayerDisplayOrder(gameData.turnOrder, userId);

	return (
		<div aria-label="Player workspaces" className="hanabi-player-workspaces grid gap-1.5">
			{displayOrder.map((playerId) => (
				<Workspace
					active={!finished && gameData.currentPlayerId === playerId}
					finished={finished}
					isLocal={userId === playerId}
					key={playerId}
					player={gameData.players[playerId]}
					thinking={
						!finished &&
						gameData.stage === HanabiStage.Playing &&
						(gameData.currentPlayerId === playerId ||
							gameData.bots?.turn?.opportunity === 'clue') &&
						gameData.players[playerId].kind === 'bot' &&
						gameData.bots?.turn?.playerId === playerId &&
						gameData.bots.turn.status === 'thinking'
					}
					thinkingLabel={
						gameData.bots?.turn?.opportunity === 'clue' ? 'Considering clue…' : 'Thinking…'
					}
				>
					{renderTileSurface(playerId)}
				</Workspace>
			))}
		</div>
	);
}

export default function HanabiPlayerWorkspace({
	active,
	children,
	finished,
	isLocal,
	player,
	review = false,
	reviewPerspective = false,
	thinking = false,
	thinkingLabel = 'Thinking…',
}: HanabiPlayerWorkspaceProps): JSX.Element {
	return (
		<section
			aria-label={`${player.name}${player.kind === 'bot' ? ', bot' : ''}${isLocal ? ', you' : ''}${reviewPerspective ? ', viewing as' : ''}${thinking ? ', thinking' : active ? (review ? ', to act' : ', playing') : ''}`}
			className={classNames(
				'hanabi-player-workspace grid h-[186px] w-full min-w-0 grid-cols-[80px_minmax(0,1fr)] overflow-hidden rounded-md border bg-hanabi-surface shadow-[0_10px_24px_rgb(0_0_0_/_16%)]',
				{
					'border-hanabi-border': !active,
					'border-hanabi-coral shadow-[0_0_0_1px_rgb(255_114_95_/_22%),0_14px_34px_rgb(0_0_0_/_26%)]':
						active,
					'opacity-70': player.kind !== 'bot' && !player.connected && !review,
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
				<HanabiPlayerAvatar player={player} showName={false} size="sm" thinking={thinking} />
				<p
					className="hanabi-player-name w-full truncate text-[17px] font-medium leading-6 text-hanabi-text"
					title={player.name}
				>
					{isLocal ? 'You' : player.name}
				</p>
				<div className="flex flex-wrap items-center justify-center gap-1.5">
					{reviewPerspective && <span className="text-sm text-hanabi-text-muted">Viewing as</span>}
					{(active || thinking) && !finished && (
						<span
							className={classNames(
								'rounded-md border px-2 py-0.5 text-[12px] font-medium leading-5 text-white shadow-[0_2px_7px_rgb(0_0_0_/_22%)]',
								active
									? 'border-hanabi-coral-soft/45 bg-hanabi-coral'
									: 'border-white/30 bg-white/10',
							)}
						>
							{thinking ? thinkingLabel : review ? 'To act' : 'Playing'}
						</span>
					)}
					{player.kind !== 'bot' && !player.connected && !review && (
						<span className="text-[12px] font-medium leading-5 text-hanabi-text-muted">
							Offline
						</span>
					)}
				</div>
			</div>
			<div className="min-w-0 overflow-hidden bg-hanabi-table/35">{children}</div>
		</section>
	);
}
