import HanabiPlayerAvatar from '~/games/hanabi/client/HanabiPlayerAvatar';
import { HanabiGameData, HanabiPlayer } from '@hanabi/shared';
import classNames from 'classnames';
import { ReactNode } from 'react';

interface WorkspaceProps {
	active: boolean;
	children: ReactNode;
	finished: boolean;
	isLocal: boolean;
	player: HanabiPlayer;
}

interface WorkspacesProps {
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

export function HanabiDesktopPlayerWorkspaces({
	gameData,
	renderTileSurface,
	userId,
}: WorkspacesProps): JSX.Element {
	const finished = gameData.finishedReason !== null;
	const displayOrder = getHanabiPlayerDisplayOrder(gameData.turnOrder, userId);

	return (
		<div aria-label="Player workspaces" className="grid gap-3">
			{displayOrder.map((playerId) => (
				<HanabiPlayerWorkspace
					active={!finished && gameData.currentPlayerId === playerId}
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
	finished,
	isLocal,
	player,
}: WorkspaceProps): JSX.Element {
	return (
		<section
			aria-label={`${player.name}${isLocal ? ', you' : ''}${active ? ', playing' : ''}`}
			className={classNames(
				'grid w-[488px] min-w-0 grid-cols-[88px_400px] overflow-hidden rounded-xl border bg-hanabi-surface shadow-[0_14px_30px_rgb(0_0_0_/_18%)]',
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
					'flex min-w-0 flex-col items-center justify-center gap-1 border-r px-2 text-center',
					active
						? 'border-hanabi-coral/45 bg-hanabi-coral/10'
						: 'border-hanabi-border bg-hanabi-table/35',
				)}
			>
				<HanabiPlayerAvatar player={player} showName={false} size="sm" />
				<p className="w-full truncate text-xs font-semibold text-hanabi-text" title={player.name}>
					{player.name}
				</p>
				<div className="flex flex-wrap items-center justify-center gap-1">
					{active && !finished && (
						<span className="rounded-full bg-hanabi-coral px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-white">
							Playing
						</span>
					)}
					{isLocal && (
						<span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-hanabi-text-muted">
							You
						</span>
					)}
					{!player.connected && (
						<span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-hanabi-text-muted">
							Offline
						</span>
					)}
				</div>
			</div>
			<div className="min-w-0">{children}</div>
		</section>
	);
}
