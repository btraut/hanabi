import HanabiAction from '~/games/hanabi/client/HanabiAction';
import {
	selectChatTranscript,
	selectGameplayHistory,
	selectLatestGameplayAction,
} from '~/games/hanabi/client/HanabiActionSelectors';
import HanabiChatInput from '~/games/hanabi/client/HanabiChatInput';
import {
	HanabiGameAction,
	HanabiGameActionType,
	HanabiGameData,
} from '@hanabi/shared';
import classNames from 'classnames';
import { KeyboardEvent, ReactNode, useEffect, useId, useRef, useState } from 'react';

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

	return actions.slice(previousActionCount).filter(
		(action) =>
			action.type === HanabiGameActionType.Chat && action.playerId !== userId,
	).length;
}

export default function HanabiActivityRail({
	composer,
	gameData,
	renderAction = (action) => <HanabiAction action={action} />,
	userId,
}: Props): JSX.Element {
	const [activeTab, setActiveTab] = useState<ActivityTab>('history');
	const [unreadChat, setUnreadChat] = useState(0);
	const previousActionCount = useRef(gameData.actions.length);
	const historyTabRef = useRef<HTMLButtonElement>(null);
	const chatTabRef = useRef<HTMLButtonElement>(null);
	const tabId = useId();
	const latestAction = selectLatestGameplayAction(gameData.actions);
	const history = selectGameplayHistory(gameData.actions);
	const chat = selectChatTranscript(gameData.actions);
	const userCanChat = Boolean(gameData.players[userId]);

	useEffect(() => {
		const incoming = countIncomingUnreadChat(
			gameData.actions,
			previousActionCount.current,
			userId,
			activeTab === 'chat',
		);
		previousActionCount.current = gameData.actions.length;

		if (activeTab === 'chat') {
			setUnreadChat(0);
		} else if (incoming) {
			setUnreadChat((count) => count + incoming);
		}
	}, [activeTab, gameData.actions, userId]);

	const activateTab = (tab: ActivityTab): void => {
		setActiveTab(tab);
		if (tab === 'chat') setUnreadChat(0);
	};

	const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>): void => {
		if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
		event.preventDefault();
		const nextTab =
			event.key === 'ArrowRight' || event.key === 'End' ? 'chat' : 'history';
		activateTab(nextTab);
		(nextTab === 'chat' ? chatTabRef : historyTabRef).current?.focus();
	};

	return (
		<aside
			aria-label="Game activity"
			className="hanabi-panel sticky top-4 flex max-h-[calc(100vh-2rem)] min-h-[420px] flex-col overflow-hidden rounded-xl"
		>
			<section aria-labelledby={`${tabId}-latest`} className="border-b border-hanabi-border p-3">
				<h2
					className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-hanabi-text-muted"
					id={`${tabId}-latest`}
				>
					Latest
				</h2>
				<div className="min-h-14 overflow-hidden rounded-lg border border-hanabi-border bg-hanabi-table/55 text-sm text-hanabi-text">
					{latestAction ? (
						renderAction(latestAction)
					) : (
						<p className="p-3 text-hanabi-text-muted">No moves yet</p>
					)}
				</div>
			</section>

			<div aria-label="Activity views" className="grid grid-cols-2 border-b border-hanabi-border" role="tablist">
				{(['history', 'chat'] as const).map((tab) => {
					const selected = activeTab === tab;
					const unread = tab === 'chat' ? unreadChat : 0;
					return (
						<button
							aria-controls={`${tabId}-${tab}-panel`}
							aria-selected={selected}
							className={classNames(
								'hanabi-focus-ring relative flex min-h-11 items-center justify-center gap-2 border-b-2 px-3 text-sm font-semibold capitalize',
								{
									'border-hanabi-coral text-hanabi-text': selected,
									'border-transparent text-hanabi-text-muted hover:text-hanabi-text': !selected,
								},
							)}
							id={`${tabId}-${tab}-tab`}
							key={tab}
							onClick={() => activateTab(tab)}
							onKeyDown={handleTabKeyDown}
							ref={tab === 'chat' ? chatTabRef : historyTabRef}
							role="tab"
							tabIndex={selected ? 0 : -1}
						>
							{tab}
							{unread > 0 && (
								<span
									aria-label={`${unread} unread chat ${unread === 1 ? 'message' : 'messages'}`}
									className="hanabi-unread-pulse min-w-5 rounded-full bg-hanabi-coral px-1.5 py-0.5 text-center text-[10px] leading-4 text-white"
								>
									{unread}
								</span>
							)}
						</button>
					);
				})}
			</div>

			<div
				aria-labelledby={`${tabId}-history-tab`}
				className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
				hidden={activeTab !== 'history'}
				id={`${tabId}-history-panel`}
				role="tabpanel"
				tabIndex={0}
			>
				{history.length ? (
					history.map((action) => (
						<div
							className="border-b border-hanabi-border/70 text-sm text-hanabi-text last:border-b-0"
							key={action.id}
						>
							{renderAction(action)}
						</div>
					))
				) : (
					<p className="p-4 text-sm text-hanabi-text-muted">Moves will appear here</p>
				)}
			</div>

			<div
				aria-labelledby={`${tabId}-chat-tab`}
				className="min-h-0 flex-1 flex-col"
				hidden={activeTab !== 'chat'}
				id={`${tabId}-chat-panel`}
				role="tabpanel"
				tabIndex={0}
			>
				<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
					{chat.length ? (
						chat.map((action) => (
							<div
								className="border-b border-hanabi-border/70 text-sm text-hanabi-text last:border-b-0"
								key={action.id}
							>
								{renderAction(action)}
							</div>
						))
					) : (
						<p className="p-4 text-sm text-hanabi-text-muted">No messages yet. Say hello.</p>
					)}
				</div>
				{userCanChat && (
					<div className="border-t border-hanabi-border">
						{composer === undefined ? <HanabiChatInput variant="desktop" /> : composer}
					</div>
				)}
			</div>
		</aside>
	);
}
