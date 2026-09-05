import HanabiActivityEvent from '~/games/hanabi/client/HanabiActivityEvent';
import { selectChatTranscript } from '~/games/hanabi/client/HanabiActionSelectors';
import HanabiChatInput from '~/games/hanabi/client/HanabiChatInput';
import { useHanabiHighlightContext } from '~/games/hanabi/client/HanabiHighlightContext';
import { getHanabiActionHighlight } from '~/games/hanabi/client/useActionHighlighter';
import { getHanabiPlayerAccent } from '~/games/hanabi/client/HanabiPlayerWorkspace';
import ChatBubble from '~/games/hanabi/client/icons/ChatBubble';
import X from '~/games/hanabi/client/icons/X';
import { HanabiGameAction, HanabiGameActionType, HanabiGameData } from '@hanabi/shared';
import classNames from 'classnames';
import FocusLock from 'react-focus-lock';
import { ReactNode, useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

type ActivityGameData = Pick<HanabiGameData, 'actions' | 'players' | 'turnOrder'>;

interface Props {
	composer?: ReactNode;
	gameData: ActivityGameData;
	renderAction?: (action: HanabiGameAction) => ReactNode;
	userId: string;
}

export function countIncomingUnreadChat(
	actions: readonly HanabiGameAction[],
	previousActionId: string | null,
	userId: string,
	chatIsOpen: boolean,
): number {
	if (chatIsOpen) return 0;

	return actions
		.slice(
			previousActionId === null
				? 0
				: actions.findIndex((action) => action.id === previousActionId) + 1,
		)
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
	const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
	const [unreadChat, setUnreadChat] = useState(
		() =>
			selectChatTranscript(gameData.actions).filter((action) => action.playerId !== userId).length,
	);
	const [feedIsNearBottom, setFeedIsNearBottom] = useState(true);
	const [hasNewActivityBelow, setHasNewActivityBelow] = useState(false);
	const usesActivityDrawer = useUsesActivityDrawer();
	const previousActionId = useRef(gameData.actions.at(-1)?.id ?? null);
	const mobileTriggerRef = useRef<HTMLButtonElement>(null);
	const mobileCloseRef = useRef<HTMLButtonElement>(null);
	const feedScrollerRef = useRef<HTMLDivElement>(null);
	const feedContentRef = useRef<HTMLDivElement>(null);
	const headingId = useId();
	const userCanChat = Boolean(gameData.players[userId]);

	const scrollFeedToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
		const scroller = feedScrollerRef.current;
		if (!scroller) return;
		scroller.scrollTo({ behavior, top: scroller.scrollHeight - scroller.clientHeight });
		setFeedIsNearBottom(true);
		setHasNewActivityBelow(false);
	}, []);

	useEffect(() => {
		const chatIsOpen = !usesActivityDrawer || mobileSheetOpen;
		const incoming = countIncomingUnreadChat(
			gameData.actions,
			previousActionId.current,
			userId,
			chatIsOpen,
		);
		const latestActionId = gameData.actions.at(-1)?.id ?? null;
		const receivedNewActivity =
			latestActionId !== null && latestActionId !== previousActionId.current;
		previousActionId.current = latestActionId;

		if (chatIsOpen) {
			setUnreadChat(0);
			if (receivedNewActivity && !feedIsNearBottom) setHasNewActivityBelow(true);
		} else if (incoming) {
			setUnreadChat((count) => count + incoming);
		}
	}, [gameData.actions, feedIsNearBottom, mobileSheetOpen, userId, usesActivityDrawer]);

	useEffect(() => {
		const scroller = feedScrollerRef.current;
		const messages = feedContentRef.current;
		if (!scroller || !messages || (usesActivityDrawer && !mobileSheetOpen)) return;

		scrollFeedToBottom('instant');
		let hadOverflow = scroller.scrollHeight > scroller.clientHeight;
		const observer = new ResizeObserver(() => {
			const hasOverflow = scroller.scrollHeight > scroller.clientHeight;
			// Establish the end snap when a short conversation first becomes scrollable.
			// Subsequent growth stays pinned through CSS re-snapping, without scroll tracking.
			if (!hadOverflow && hasOverflow) scrollFeedToBottom('instant');
			hadOverflow = hasOverflow;
		});
		observer.observe(messages);
		observer.observe(scroller);
		return () => observer.disconnect();
	}, [mobileSheetOpen, scrollFeedToBottom, usesActivityDrawer]);

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

	const handleFeedScroll = (): void => {
		const scroller = feedScrollerRef.current;
		if (!scroller) return;
		const nearBottom = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 56;
		setFeedIsNearBottom(nearBottom);
		if (nearBottom) setHasNewActivityBelow(false);
	};

	const activityPanel = (mobile: boolean): JSX.Element => (
		<section
			aria-labelledby={headingId}
			className={classNames('hanabi-panel hanabi-activity-panel', {
				'hanabi-mobile-sheet-panel': mobile,
			})}
		>
			<header className="hanabi-feed-header">
				<div>
					<h2 id={headingId}>Activity</h2>
				</div>
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
			</header>
			<div
				aria-label="Moves and messages"
				className="hanabi-feed-transcript"
				onScroll={handleFeedScroll}
				ref={feedScrollerRef}
				role="region"
				tabIndex={0}
			>
				<div className="hanabi-feed-content" ref={feedContentRef}>
					{gameData.actions.length ? (
						gameData.actions.map((action) => {
							if (action.type === HanabiGameActionType.Chat) {
								return (
									<div className="hanabi-feed-chat" key={action.id}>
										{renderAction ? (
											renderAction(action)
										) : (
											<HanabiChatMessage action={action} gameData={gameData} userId={userId} />
										)}
									</div>
								);
							}
							const actionHighlight = getHanabiActionHighlight(action);
							const thisActionHighlighted = highlightedAction === action.id;
							const content = renderAction ? (
								renderAction(action)
							) : (
								<HanabiActivityEvent
									action={action}
									gameData={gameData}
									timeLabel={action.createdAt ? formatChatTime(action.createdAt) : undefined}
									userId={userId}
								/>
							);
							return (
								<div className="hanabi-feed-event" key={action.id}>
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
						<div className="hanabi-chat-empty">
							<ChatBubble size={28} />
							<p>The table is quiet</p>
							<span>Moves and messages will appear here.</span>
						</div>
					)}
				</div>
				{hasNewActivityBelow && (
					<button
						className="hanabi-new-message-button"
						onClick={() => scrollFeedToBottom()}
						type="button"
					>
						New activity ↓
					</button>
				)}
				<div aria-hidden="true" className="hanabi-feed-end" key="feed-end" />
			</div>
			{userCanChat && (
				<div className="hanabi-chat-composer">
					{composer === undefined ? <HanabiChatInput variant="desktop" /> : composer}
				</div>
			)}
		</section>
	);

	if (usesActivityDrawer) {
		return createPortal(
			<div className="hanabi-mobile-activity">
				<button
					aria-hidden={mobileSheetOpen}
					aria-expanded={mobileSheetOpen}
					aria-haspopup="dialog"
					aria-label={
						unreadChat ? `Open activity, ${unreadChat} unread chat messages` : 'Open activity'
					}
					className="hanabi-mobile-chat-trigger hanabi-focus-ring"
					onClick={() => {
						setMobileSheetOpen(true);
					}}
					ref={mobileTriggerRef}
					tabIndex={mobileSheetOpen ? -1 : 0}
					type="button"
				>
					<ChatBubble size={22} />
					<span className="hanabi-mobile-chat-trigger-label">Activity</span>
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
		<aside aria-label="Game activity" className="hanabi-activity-rail">
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
	gameData: ActivityGameData;
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
				<div className="hanabi-chat-meta">
					<p className="hanabi-chat-author" style={{ color: accent }}>
						{name}
					</p>
					{action.createdAt && (
						<time className="hanabi-chat-time">{formatChatTime(action.createdAt)}</time>
					)}
				</div>
				<p className="hanabi-chat-bubble">{action.message}</p>
			</div>
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

function formatChatTime(createdAt: string): string {
	return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(
		new Date(createdAt),
	);
}
