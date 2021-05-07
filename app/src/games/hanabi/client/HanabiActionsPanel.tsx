import { useBreakpointContext } from 'app/src/components/BreakpointContext';
import { useUserId } from 'app/src/components/SocketContext';
import HanabiActions from 'app/src/games/hanabi/client/HanabiActions';
import HanabiActionsFilter from 'app/src/games/hanabi/client/HanabiActionsFilter';
import HanabiChatInput from 'app/src/games/hanabi/client/HanabiChatInput';
import { useGameData } from 'app/src/games/hanabi/client/HanabiGameContext';
import { useLatestActionEffect } from 'app/src/games/hanabi/client/useLatestActions';
import { ActionsFilterOption, HanabiGameAction } from 'app/src/games/hanabi/HanabiGameData';
import classNames from 'classnames';
import { useCallback, useRef, useState } from 'react';

export default function HanabiActionsPanel(): JSX.Element {
	const gameData = useGameData();
	const userId = useUserId();
	const userIsPlayer = !!(userId && gameData.players[userId]);

	const breakpoints = useBreakpointContext();

	const [actionsFilter, setActionsFilter] = useState<ActionsFilterOption>('all');

	const scrollContainerRef = useRef<HTMLDivElement | null>(null);

	// When a new action happens, scroll the actions container to the top.
	useLatestActionEffect(
		useCallback((latestAction: HanabiGameAction | null) => {
			if (latestAction) {
				scrollContainerRef.current?.scrollTo(0, 0);
			}
		}, []),
	);

	// Show gradients showing that the user can scroll.
	const [showTopGradient, setShowTopGradient] = useState(false);
	const [showBottomGradient, setShowBottomGradient] = useState(false);

	const checkGradient = useCallback(() => {
		if (!scrollContainerRef.current) {
			return;
		}

		if (scrollContainerRef.current.scrollHeight === scrollContainerRef.current.clientHeight) {
			setShowTopGradient(false);
			setShowBottomGradient(false);
			return;
		}

		const scrolledToTop = scrollContainerRef.current.scrollTop === 0;
		const scrolledToBottom =
			scrollContainerRef.current.scrollTop + scrollContainerRef.current.clientHeight ===
			scrollContainerRef.current.scrollHeight;

		setShowTopGradient(!scrolledToTop);
		setShowBottomGradient(!scrolledToBottom);
	}, []);

	useLatestActionEffect(() => {
		checkGradient();
	});

	return (
		<div
			className={classNames('flex flex-col border-4 border-black rounded-xl mb-6 overflow-hidden', {
				'bg-white': gameData.actions.length % 2 === 1,
				'bg-gray-200': gameData.actions.length % 2 === 0,
			})}
			style={{ maxHeight: breakpoints.lg ? 320 : 240 }}
		>
			<div className="flex-none border-solid border-gray-600 border-b-2 bg-gray-300">
				<HanabiActionsFilter filter={actionsFilter} onChange={setActionsFilter} />
			</div>
			<div className="flex-1 relative flex flex-col overflow-hidden">
				<div className="flex-1 overflow-y-auto" ref={scrollContainerRef} onScroll={checkGradient}>
					<HanabiActions filter={actionsFilter} />
				</div>
				<div
					className={classNames(
						'absolute top-0 left-0 right-0 h-3 bg-gradient-to-b from-black pointer-events-none transition-all',
						{
							'opacity-20': showTopGradient,
							'opacity-0': !showTopGradient,
						},
					)}
				/>
				<div
					className={classNames(
						'absolute bottom-0 left-0 right-0 h-3 bg-gradient-to-t from-black pointer-events-none transition-all',
						{
							'opacity-20': showBottomGradient,
							'opacity-0': !showBottomGradient,
						},
					)}
				/>
			</div>
			{userIsPlayer && (
				<div className="flex-none border-solid border-gray-600 border-t-2 bg-gray-300">
					<HanabiChatInput />
				</div>
			)}
		</div>
	);
}
