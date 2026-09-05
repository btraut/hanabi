import {
	getHanabiPlayerAccent,
	HANABI_PLAYER_ACCENTS,
} from '~/games/hanabi/client/HanabiPlayerWorkspace';
import { HanabiGameAction, HanabiGameActionType, HanabiGameData } from '@hanabi/shared';
import { ReactNode } from 'react';

const ACTION_ACCENTS: Record<string, string> = {
	red: '#d36b65',
	blue: '#638fd1',
	green: '#6cab7f',
	yellow: '#d5ad61',
	white: '#eee9df',
	purple: '#9278c4',
	rainbow: '#ed9588',
	black: '#738096',
};

export default function HanabiActivityEvent({
	action,
	gameData,
	timeLabel,
	userId,
}: {
	action: HanabiGameAction;
	gameData: Pick<HanabiGameData, 'actions' | 'players' | 'turnOrder'>;
	timeLabel?: string;
	userId: string;
}): JSX.Element {
	const playerId =
		'playerId' in action
			? action.playerId
			: action.type === HanabiGameActionType.GameStarted
				? action.startingPlayerId
				: null;
	const player = playerId ? gameData.players[playerId] : undefined;
	const playerAccent = playerId
		? getHanabiPlayerAccent(gameData.turnOrder, userId, playerId)
		: HANABI_PLAYER_ACCENTS[0];
	let actionAccent = playerAccent;
	let summary: ReactNode = 'Game updated';
	let detail: ReactNode = null;
	let recipientName: string | null = null;

	if (action.type === HanabiGameActionType.Play) {
		actionAccent = ACTION_ACCENTS[action.tile.color] ?? playerAccent;
		summary = (
			<>
				played{' '}
				<span className="hanabi-feed-action-value" style={{ color: actionAccent }}>
					{capitalize(action.tile.color)} {action.tile.number}
				</span>
			</>
		);
		detail = action.valid ? null : 'Invalid play';
	} else if (action.type === HanabiGameActionType.Discard) {
		actionAccent = ACTION_ACCENTS[action.tile.color] ?? playerAccent;
		summary = (
			<>
				discarded{' '}
				<span className="hanabi-feed-action-value" style={{ color: actionAccent }}>
					{capitalize(action.tile.color)} {action.tile.number}
				</span>
			</>
		);
	} else if (
		action.type === HanabiGameActionType.GiveColorClue ||
		action.type === HanabiGameActionType.GiveNumberClue
	) {
		const recipient = gameData.players[action.recipientId];
		recipientName = recipient?.name ?? 'another player';
		const clueValue =
			action.type === HanabiGameActionType.GiveColorClue
				? capitalize(action.color ?? 'color')
				: action.number;
		const clueColor =
			action.type === HanabiGameActionType.GiveColorClue
				? ACTION_ACCENTS[action.color ?? '']
				: undefined;
		summary = (
			<>
				<span className="hanabi-feed-action-value" style={{ color: clueColor }}>
					{clueValue}
				</span>{' '}
				clue
			</>
		);
	} else if (action.type === HanabiGameActionType.GameStarted) {
		summary = `The game began with ${player?.name ?? 'a player'} first`;
	} else if (action.type === HanabiGameActionType.GameFinished) {
		summary = 'The game finished';
	} else if (action.type === HanabiGameActionType.ShotClockStarted) {
		summary = `${action.remainingTurns} turns remain`;
	} else if (action.type === HanabiGameActionType.ShotClockTickedDown) {
		summary = `${action.remainingTurns} turns remain`;
	} else if (action.type === HanabiGameActionType.Chat) {
		summary = action.message;
	}
	return (
		<div className="hanabi-feed-event-content">
			<div className="min-w-0 flex-1 break-words">
				{'playerId' in action && (
					<p className="hanabi-feed-event-people">
						{player?.name ?? 'Player'}
						{recipientName && (
							<>
								<span className="sr-only"> clued </span>
								<span aria-hidden="true" className="hanabi-feed-event-arrow">
									{' '}
									→{' '}
								</span>
								{recipientName}
							</>
						)}
					</p>
				)}
				<p className="hanabi-feed-event-summary">{summary}</p>
				{detail && <p className="hanabi-feed-event-detail">{detail}</p>}
			</div>
			{timeLabel && <span className="hanabi-chat-time">{timeLabel}</span>}
		</div>
	);
}

function capitalize(value: string): string {
	return value.charAt(0).toUpperCase() + value.slice(1);
}
