import HanabiDesktopStatus from '~/games/hanabi/client/HanabiDesktopStatus';
import { getHanabiRuleSetColors, HanabiGameData } from '@hanabi/shared';
import { ReactNode } from 'react';

interface Props {
	activity?: ReactNode;
	gameData: HanabiGameData;
	playerWorkspaces?: ReactNode;
	status?: ReactNode;
	tableau?: ReactNode;
	userId: string;
}

export default function HanabiDesktopBoard({
	activity,
	gameData,
	playerWorkspaces,
	status,
	tableau,
	userId,
}: Props): JSX.Element {
	return (
		<main className="hanabi-desktop-board mx-auto grid w-[calc(100vw-42px)] max-w-[1660px] items-start pb-5">
			{status ?? <HanabiDesktopStatus gameData={gameData} userId={userId} />}
			<div className="col-start-1 row-start-2 min-w-0" data-desktop-region="tableau">
				{tableau ?? (
					<TableauGeometryProbe lanes={getHanabiRuleSetColors(gameData.ruleSet).length} />
				)}
			</div>
			<div className="col-start-2 row-start-2 min-w-0" data-desktop-region="workspaces">
				{playerWorkspaces ?? <WorkspaceGeometryProbe players={gameData.turnOrder.length} />}
			</div>
			<div className="col-start-3 row-start-2 min-w-0" data-desktop-region="activity">
				{activity ?? <ActivityGeometryProbe actions={gameData.actions.length} />}
			</div>
		</main>
	);
}

function Probe({
	children,
	className = '',
}: {
	children: ReactNode;
	className?: string;
}): JSX.Element {
	return (
		<div
			className={`hanabi-panel rounded-xl border-dashed p-3 text-xs text-hanabi-text-muted ${className}`}
		>
			{children}
		</div>
	);
}

function TableauGeometryProbe({ lanes }: { lanes: number }): JSX.Element {
	return (
		<Probe className="grid gap-2">
			{Array.from({ length: lanes }, (_, index) => (
				<div
					className="h-14 rounded-lg border border-hanabi-border bg-hanabi-table/45"
					key={index}
				/>
			))}
		</Probe>
	);
}

function WorkspaceGeometryProbe({ players }: { players: number }): JSX.Element {
	return (
		<div className="grid gap-3">
			{Array.from({ length: players }, (_, index) => (
				<Probe className="h-[140px]" key={index}>
					<span className="sr-only">Player workspace {index + 1}</span>
				</Probe>
			))}
		</div>
	);
}

function ActivityGeometryProbe({ actions }: { actions: number }): JSX.Element {
	return (
		<Probe className="sticky top-4 grid min-h-80 content-start gap-2">
			<div className="h-16 rounded-lg border border-hanabi-border bg-hanabi-table/45" />
			<div className="h-9 rounded-lg border border-hanabi-border bg-hanabi-table/45" />
			{Array.from({ length: Math.min(Math.max(actions, 4), 8) }, (_, index) => (
				<div className="h-8 rounded-md bg-hanabi-table/45" key={index} />
			))}
		</Probe>
	);
}
