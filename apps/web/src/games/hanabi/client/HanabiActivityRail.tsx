import {
	selectChatTranscript,
	selectGameplayHistory,
} from '~/games/hanabi/client/HanabiActionSelectors';
import HanabiChatInput from '~/games/hanabi/client/HanabiChatInput';
import { useHanabiHighlightContext } from '~/games/hanabi/client/HanabiHighlightContext';
import { getHanabiActionHighlight } from '~/games/hanabi/client/useActionHighlighter';
import {
	getHanabiPlayerAccent,
	HANABI_PLAYER_ACCENTS,
} from '~/games/hanabi/client/HanabiPlayerWorkspace';
import ChatBubble from '~/games/hanabi/client/icons/ChatBubble';
import X from '~/games/hanabi/client/icons/X';
import { HanabiGameAction, HanabiGameActionType, HanabiGameData } from '@hanabi/shared';
import classNames from 'classnames';
import FocusLock from 'react-focus-lock';
import { KeyboardEvent, ReactNode, useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

type ActivityTab = 'chat' | 'history';

interface Props {
	composer?: ReactNode;
	gameData: HanabiGameData;
	renderAction?: (action: HanabiGameAction) => ReactNode;
	userId: string;
}

export function countIncomingUnreadChat(
	actions: readonly HanabiGameAction[],
	previousActionCount: number,
	userId: string,
	chatIsOpen: boolean,
): number {
	if (chatIsOpen || previousActionCount >= actions.length) return 0;

	return actions
		.slice(previousActionCount)
		.filter((action) => action.type === HanabiGameActionType.Chat && action.playerId !== userId)
		.length;
}

export default function HanabiActivityRail({
	composer,
	gameData,
	renderAction,
	userId,
}: Props): JSX.Element {
	const { highlightAction, highlightedAction } = useHanabiHighlightContext();
	const [activeTab, setActiveTab] = useState<ActivityTab>('history');
	const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
	const [unreadChat, setUnreadChat] = useState(
		() =>
			selectChatTranscript(gameData.actions).filter((action) => action.playerId !== userId).length,
	);
	const [chatIsNearBottom, setChatIsNearBottom] = useState(true);
	const [hasNewMessagesBelow, setHasNewMessagesBelow] = useState(false);
	const usesActivityDrawer = useUsesActivityDrawer();
	const previousActionCount = useRef(gameData.actions.length);
	const previousChatCount = useRef(selectChatTranscript(gameData.actions).length);
	const historyTabRef = useRef<HTMLButtonElement>(null);
	const chatTabRef = useRef<HTMLButtonElement>(null);
	const mobileTriggerRef = useRef<HTMLButtonElement>(null);
	const mobileCloseRef = useRef<HTMLButtonElement>(null);
	const chatScrollerRef = useRef<HTMLDivElement>(null);
	const tabId = useId();
	const history = selectGameplayHistory(gameData.actions);
	const chat = selectChatTranscript(gameData.actions);
	const userCanChat = Boolean(gameData.players[userId]);

	const scrollChatToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
		const scroller = chatScrollerRef.current;
		if (!scroller) return;
		scroller.scrollTo({ behavior, top: scroller.scrollHeight });
		setChatIsNearBottom(true);
		setHasNewMessagesBelow(false);
	}, []);

	useEffect(() => {
		const chatIsOpen = activeTab === 'chat' && (!usesActivityDrawer || mobileSheetOpen);
		const incoming = countIncomingUnreadChat(
			gameData.actions,
			previousActionCount.current,
			userId,
			chatIsOpen,
		);
		previousActionCount.current = gameData.actions.length;

		if (chatIsOpen) {
			setUnreadChat(0);
		} else if (incoming) {
			setUnreadChat((count) => count + incoming);
		}
	}, [activeTab, gameData.actions, mobileSheetOpen, userId, usesActivityDrawer]);

	useEffect(() => {
		const receivedNewChat = chat.length > previousChatCount.current;
		previousChatCount.current = chat.length;
		if (!receivedNewChat || activeTab !== 'chat' || (usesActivityDrawer && !mobileSheetOpen))
			return;

		if (chatIsNearBottom) {
			requestAnimationFrame(() => scrollChatToBottom());
		} else {
			setHasNewMessagesBelow(true);
		}
	}, [
		activeTab,
		chat.length,
		chatIsNearBottom,
		mobileSheetOpen,
		scrollChatToBottom,
		usesActivityDrawer,
	]);

	useEffect(() => {
		if (!mobileSheetOpen) return;
		const surface = document.querySelector<HTMLElement>('.hanabi-responsive-game-surface');
		const mobileTrigger = mobileTriggerRef.current;
		const previousOverflow = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		surface?.setAttribute('inert', '');
		requestAnimationFrame(() => mobileCloseRef.current?.focus());

		const handleEscape = (event: globalThis.KeyboardEvent): void => {
			if (event.key === 'Escape') setMobileSheetOpen(false);
		};
		document.addEventListener('keydown', handleEscape);

		return () => {
			document.body.style.overflow = previousOverflow;
			surface?.removeAttribute('inert');
			document.removeEventListener('keydown', handleEscape);
			mobileTrigger?.focus();
		};
	}, [mobileSheetOpen]);

	useEffect(() => {
		if (!usesActivityDrawer) setMobileSheetOpen(false);
	}, [usesActivityDrawer]);

	const activateTab = (tab: ActivityTab): void => {
		setActiveTab(tab);
		if (tab === 'chat') {
			setUnreadChat(0);
			requestAnimationFrame(() => scrollChatToBottom('auto'));
		}
	};

	const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>): void => {
		if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
		event.preventDefault();
		const nextTab = event.key === 'ArrowRight' || event.key === 'End' ? 'chat' : 'history';
		activateTab(nextTab);
		(nextTab === 'chat' ? chatTabRef : historyTabRef).current?.focus();
	};

	const handleChatScroll = (): void => {
		const scroller = chatScrollerRef.current;
		if (!scroller) return;
		const nearBottom = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 56;
		setChatIsNearBottom(nearBottom);
		if (nearBottom) setHasNewMessagesBelow(false);
	};

	const renderActivityAction = (
		action: HanabiGameAction,
		variant: 'chat' | 'history',
		timeLabel?: string,
	): ReactNode =>
		renderAction ? (
			renderAction(action)
		) : variant === 'chat' && action.type === HanabiGameActionType.Chat ? (
			<HanabiChatMessage action={action} gameData={gameData} userId={userId} />
		) : (
			<HanabiDesktopActivityAction
				action={action}
				compact={false}
				gameData={gameData}
				timeLabel={timeLabel}
				userId={userId}
			/>
		);

	const activityPanel = (mobile: boolean): JSX.Element => {
		const tabs: ActivityTab[] = mobile ? ['chat', 'history'] : ['history', 'chat'];
		return (
			<section
				className={classNames('hanabi-panel hanabi-activity-panel', {
					'hanabi-mobile-sheet-panel': mobile,
				})}
			>
				{mobile && (
					<button
						aria-label="Close activity"
						className="hanabi-mobile-sheet-close hanabi-focus-ring"
						onClick={() => setMobileSheetOpen(false)}
						ref={mobileCloseRef}
						type="button"
					>
						<X color="#eeeae2" size={18} />
					</button>
				)}
				<div
					aria-label="Activity views"
					className={classNames('hanabi-activity-tabs border-b border-hanabi-border', {
						'hanabi-mobile-activity-tabs': mobile,
					})}
					role="tablist"
				>
					{tabs.map((tab) => {
						const selected = activeTab === tab;
						const unread = tab === 'chat' ? unreadChat : 0;
						return (
							<button
								aria-controls={`${tabId}-${mobile ? 'mobile-' : ''}${tab}-panel`}
								aria-selected={selected}
								className={classNames(
									'hanabi-activity-tab hanabi-focus-ring relative flex items-center justify-center gap-2 font-semibold capitalize',
									selected ? 'text-hanabi-coral' : 'text-hanabi-text-muted hover:text-hanabi-text',
								)}
								id={`${tabId}-${mobile ? 'mobile-' : ''}${tab}-tab`}
								key={tab}
								onClick={() => activateTab(tab)}
								onKeyDown={handleTabKeyDown}
								ref={tab === 'chat' ? chatTabRef : historyTabRef}
								role="tab"
								tabIndex={selected ? 0 : -1}
								type="button"
							>
								{tab}
								{selected && <span aria-hidden="true" className="hanabi-activity-tab-indicator" />}
								{unread > 0 && (
									<span
										aria-label={`${unread} unread chat ${unread === 1 ? 'message' : 'messages'}`}
										className="hanabi-unread-pulse min-w-6 rounded-full bg-hanabi-text-muted/35 px-1.5 py-0.5 text-center text-[11px] leading-5 text-hanabi-text"
									>
										{unread}
									</span>
								)}
							</button>
						);
					})}
				</div>

				<div
					aria-labelledby={`${tabId}-${mobile ? 'mobile-' : ''}history-tab`}
					className="hanabi-activity-transcript"
					hidden={activeTab !== 'history'}
					id={`${tabId}-${mobile ? 'mobile-' : ''}history-panel`}
					role="tabpanel"
					tabIndex={0}
				>
					{history.length ? (
						history.map((action, index) => {
							const actionHighlight = getHanabiActionHighlight(action);
							const thisActionHighlighted = highlightedAction === action.id;
							const content = renderActivityAction(
								action,
								'history',
								formatRelativeTime(action.createdAt, index),
							);
							return (
								<div
									className="border-b border-hanabi-border/70 text-sm text-hanabi-text last:border-b-0"
									key={action.id}
								>
									{actionHighlight ? (
										<button
											aria-pressed={thisActionHighlighted}
											className={classNames(
												'hanabi-history-action hanabi-focus-ring',
												`hanabi-tile-emphasis-${actionHighlight.tone}`,
												{ 'is-selected': thisActionHighlighted },
											)}
											onClick={() => {
												highlightAction(thisActionHighlighted ? null : action.id);
												if (mobile) setMobileSheetOpen(false);
											}}
											type="button"
										>
											{content}
										</button>
									) : (
										content
									)}
								</div>
							);
						})
					) : (
						<p className="p-5 text-sm text-hanabi-text-muted">Moves will appear here</p>
					)}
				</div>

				<div
					aria-labelledby={`${tabId}-${mobile ? 'mobile-' : ''}chat-tab`}
					className="hanabi-chat-tab-panel"
					hidden={activeTab !== 'chat'}
					id={`${tabId}-${mobile ? 'mobile-' : ''}chat-panel`}
					role="tabpanel"
				>
					<div
						className="hanabi-chat-transcript"
						onScroll={handleChatScroll}
						ref={chatScrollerRef}
						tabIndex={0}
					>
						{chat.length ? (
							chat.map((action) => (
								<div className="hanabi-chat-message-wrap" key={action.id}>
									{renderActivityAction(action, 'chat')}
								</div>
							))
						) : (
							<div className="hanabi-chat-empty">
								<ChatBubble size={28} />
								<p>No messages yet</p>
								<span>Break the suspicious silence.</span>
							</div>
						)}
						{hasNewMessagesBelow && (
							<button
								className="hanabi-new-message-button"
								onClick={() => scrollChatToBottom()}
								type="button"
							>
								New messages
							</button>
						)}
					</div>
					{userCanChat && (
						<div className="hanabi-chat-composer">
							{composer === undefined ? <HanabiChatInput variant="desktop" /> : composer}
						</div>
					)}
				</div>
			</section>
		);
	};

	if (usesActivityDrawer) {
		return createPortal(
			<div className="hanabi-mobile-activity">
				<button
					aria-hidden={mobileSheetOpen}
					aria-expanded={mobileSheetOpen}
					aria-haspopup="dialog"
					className="hanabi-mobile-chat-trigger hanabi-focus-ring"
					onClick={() => {
						activateTab('chat');
						setMobileSheetOpen(true);
					}}
					ref={mobileTriggerRef}
					tabIndex={mobileSheetOpen ? -1 : 0}
					type="button"
				>
					<ChatBubble size={22} />
					<span className="hanabi-mobile-chat-trigger-label">Chat</span>
					{unreadChat > 0 && <span className="hanabi-mobile-chat-badge">{unreadChat}</span>}
				</button>
				<button
					aria-hidden="true"
					className={classNames('hanabi-mobile-sheet-backdrop', { 'is-open': mobileSheetOpen })}
					onClick={() => setMobileSheetOpen(false)}
					tabIndex={-1}
					type="button"
				/>
				<FocusLock disabled={!mobileSheetOpen} returnFocus>
					<div
						aria-hidden={!mobileSheetOpen}
						aria-label="Game activity"
						aria-modal="true"
						className={classNames('hanabi-mobile-sheet', { 'is-open': mobileSheetOpen })}
						role="dialog"
					>
						{activityPanel(true)}
					</div>
				</FocusLock>
			</div>,
			document.body,
		);
	}

	return (
		<aside
			aria-label="Game activity"
			className="hanabi-activity-rail sticky top-4 flex h-[calc(100dvh-118px)] min-h-[500px] flex-col"
		>
			{activityPanel(false)}
		</aside>
	);
}

function HanabiChatMessage({
	action,
	gameData,
	userId,
}: {
	action: Extract<HanabiGameAction, { type: HanabiGameActionType.Chat }>;
	gameData: HanabiGameData;
	userId: string;
}): JSX.Element {
	const player = gameData.players[action.playerId];
	const accent = getHanabiPlayerAccent(gameData.turnOrder, userId, action.playerId);
	const name = action.playerId === userId ? 'You' : (player?.name ?? 'Player');

	return (
		<div className="hanabi-chat-message">
			<span aria-hidden="true" className="hanabi-chat-avatar" style={{ backgroundColor: accent }}>
				{(player?.name ?? 'P').charAt(0).toUpperCase()}
			</span>
			<div className="min-w-0">
				<p className="hanabi-chat-author" style={{ color: accent }}>
					{name}
				</p>
				<p className="hanabi-chat-bubble">{action.message}</p>
			</div>
			{action.createdAt && (
				<time className="hanabi-chat-time">{formatChatTime(action.createdAt)}</time>
			)}
		</div>
	);
}

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

function HanabiDesktopActivityAction({
	action,
	compact,
	gameData,
	timeLabel,
	userId,
}: {
	action: HanabiGameAction;
	compact: boolean;
	gameData: HanabiGameData;
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
	let detail: string | null = null;

	if (action.type === HanabiGameActionType.Play) {
		actionAccent = ACTION_ACCENTS[action.tile.color] ?? playerAccent;
		summary = (
			<>
				Played{' '}
				<span style={{ color: actionAccent }}>
					{capitalize(action.tile.color)} {action.tile.number}
				</span>
			</>
		);
		detail = action.valid ? null : 'Invalid play';
	} else if (action.type === HanabiGameActionType.Discard) {
		actionAccent = ACTION_ACCENTS[action.tile.color] ?? playerAccent;
		summary = (
			<>
				Discarded{' '}
				<span style={{ color: actionAccent }}>
					{capitalize(action.tile.color)} {action.tile.number}
				</span>
			</>
		);
	} else if (
		action.type === HanabiGameActionType.GiveColorClue ||
		action.type === HanabiGameActionType.GiveNumberClue
	) {
		const recipient = gameData.players[action.recipientId];
		summary = `Gave a clue to ${recipient?.name ?? 'another player'}`;
		actionAccent =
			action.type === HanabiGameActionType.GiveColorClue
				? (ACTION_ACCENTS[action.color ?? ''] ?? playerAccent)
				: ACTION_ACCENTS.yellow;
		detail =
			action.type === HanabiGameActionType.GiveColorClue
				? `${capitalize(action.color ?? 'color')}: ${action.tiles.length}`
				: `Number: ${action.number}`;
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
	const ringAccent =
		action.type === HanabiGameActionType.Discard && action.tile.color === 'blue'
			? playerAccent
			: actionAccent;

	return (
		<div
			className={classNames(
				'flex min-w-0',
				compact ? 'items-center gap-5' : 'gap-[17px] py-[17px] pl-[31px] pr-8',
			)}
		>
			<span
				aria-hidden="true"
				className={classNames(
					'shrink-0 rounded-full border-2 shadow-[inset_0_0_0_3px_rgb(10_30_51_/_95%)]',
					compact ? '-mt-1 size-9 bg-current/55' : 'mt-0.5 size-9',
				)}
				style={{ borderColor: ringAccent, color: ringAccent }}
			/>
			<div className="min-w-0 flex-1">
				{compact ? (
					<p className="text-[17px] leading-6 text-hanabi-text">
						{action.type === HanabiGameActionType.GameStarted ? (
							summary
						) : (
							<>
								<span className="font-medium text-hanabi-text">{player?.name ?? 'Game'}</span>{' '}
								{lowerFirst(summary)}
							</>
						)}
					</p>
				) : (
					<>
						<p
							className="truncate text-[18px] font-medium leading-[22px]"
							style={{ color: playerAccent }}
						>
							{player?.name ?? 'Game'}
						</p>
						<p className="text-[17px] leading-[22px] text-hanabi-text">{summary}</p>
					</>
				)}
				{detail && (
					<p className="text-[17px] font-medium leading-[22px]" style={{ color: actionAccent }}>
						{detail}
					</p>
				)}
			</div>
			{timeLabel && (
				<span className="shrink-0 pt-1 text-[14px] tabular-nums text-hanabi-text-muted">
					{timeLabel}
				</span>
			)}
		</div>
	);
}

function useUsesActivityDrawer(): boolean {
	const [usesDrawer, setUsesDrawer] = useState(
		() => typeof window !== 'undefined' && window.matchMedia('(max-width: 959px)').matches,
	);

	useEffect(() => {
		const media = window.matchMedia('(max-width: 959px)');
		const handleChange = (): void => setUsesDrawer(media.matches);
		handleChange();
		media.addEventListener('change', handleChange);
		return () => media.removeEventListener('change', handleChange);
	}, []);

	return usesDrawer;
}

function capitalize(value: string): string {
	return value.charAt(0).toUpperCase() + value.slice(1);
}

function lowerFirst(value: ReactNode): ReactNode {
	return typeof value === 'string' ? value.charAt(0).toLowerCase() + value.slice(1) : value;
}

function formatRelativeTime(
	createdAt: string | undefined,
	_fallbackIndex: number,
): string | undefined {
	if (!createdAt) return undefined;
	const elapsedMinutes = Math.max(
		1,
		Math.round((Date.now() - new Date(createdAt).getTime()) / 60_000),
	);
	return `${elapsedMinutes}m ago`;
}

function formatChatTime(createdAt: string): string {
	return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(
		new Date(createdAt),
	);
}
