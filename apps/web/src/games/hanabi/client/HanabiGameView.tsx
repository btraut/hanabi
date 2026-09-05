import BreakpointController from '~/components/BreakpointController';
import HanabiBoardPresentation from './HanabiBoardPresentation';
import HanabiMoveTileController from './HanabiMoveTileController';
import HanabiBoard from '~/games/hanabi/client/HanabiBoard';
import HanabiBotError from '~/games/hanabi/client/HanabiBotError';
import { HanabiLiveActionToasts } from './HanabiActionToasts';
import HanabiDebugPanel from '~/games/hanabi/client/HanabiDebugPanel';
import { useGameSelector } from '~/games/hanabi/client/HanabiGameContext';
import HanabiHeader from '~/games/hanabi/client/HanabiHeader';
import HanabiHighlightTileController from '~/games/hanabi/client/HanabiHighlightController';
import HanabiLobby from '~/games/hanabi/client/HanabiLobby';
import HanabiReview from '~/games/hanabi/client/HanabiReview';
import { useUserId } from '~/components/SocketContext';
import useTileDrop from '~/games/hanabi/client/useTileDrop';
import { GameTranscriptV1, HanabiStage, isReplayableTranscript } from '@hanabi/shared';
import { ReactNode, useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

export default function HanabiGameView(): JSX.Element | null {
	const stage = useGameSelector((game) => game!.stage);
	const seed = useGameSelector((game) => game!.seed);
	const availableReviewTranscript = useGameSelector((game) => game!.reviewTranscript);
	const roundId = availableReviewTranscript?.roundId ?? seed;
	const userId = useUserId();
	const [reviewTranscript, setReviewTranscript] = useState<GameTranscriptV1 | null>(null);
	const [reviewOpen, setReviewOpen] = useState(false);
	const canReview = isReplayableTranscript(availableReviewTranscript);
	const openReview = canReview
		? () => {
				setReviewTranscript(availableReviewTranscript!);
				setReviewOpen(true);
			}
		: undefined;
	const { search } = useLocation();
	const [debugPanelOpen, setDebugPanelOpen] = useState(
		() => new URLSearchParams(search).get('debug') === '1',
	);

	useEffect(() => {
		if (!import.meta.env.DEV) return;

		const toggleDebugPanel = (event: KeyboardEvent) => {
			if (
				event.altKey &&
				!event.ctrlKey &&
				!event.metaKey &&
				event.code === 'KeyD' &&
				!event.repeat
			) {
				event.preventDefault();
				setDebugPanelOpen((open) => !open);
			}
		};

		window.addEventListener('keydown', toggleDebugPanel);
		return () => window.removeEventListener('keydown', toggleDebugPanel);
	}, []);

	const showDebugPanel = import.meta.env.DEV && debugPanelOpen;

	if (reviewOpen && reviewTranscript) {
		return (
			<HanabiReview
				key={reviewTranscript.roundId}
				transcript={reviewTranscript}
				userId={userId}
				onExit={() => setReviewOpen(false)}
				exitLabel={
					roundId === reviewTranscript.roundId && stage === HanabiStage.Finished
						? 'Back to game'
						: 'Back to lobby'
				}
			/>
		);
	}

	return (
		<>
			<HanabiLiveActionToasts />
			{reviewTranscript && roundId !== reviewTranscript.roundId && (
				<div className="mx-auto max-w-[1660px] px-5 py-3">
					<button className="hanabi-review-entry" type="button" onClick={() => setReviewOpen(true)}>
						Review previous game
					</button>
				</div>
			)}
			{stage === HanabiStage.Setup && <HanabiLobby />}
			{(stage === HanabiStage.Playing || stage === HanabiStage.Finished) && (
				<HanabiBoardPresentation>
					<HanabiMoveTileController>
						<HanabiHighlightTileController>
							<BreakpointController>
								<HanabiGameSurface>
									<HanabiHeader variant="game" />
									<div className="hanabi-game-board-shell pt-5">
										<HanabiBotError />
										<HanabiBoard
											onReview={openReview}
											initiallyDismissGameOver={reviewTranscript?.roundId === roundId}
										/>
									</div>
									<div id="portal" />
								</HanabiGameSurface>
							</BreakpointController>
						</HanabiHighlightTileController>
					</HanabiMoveTileController>
				</HanabiBoardPresentation>
			)}
			{showDebugPanel && <HanabiDebugPanel />}
		</>
	);
}

function HanabiGameSurface({ children }: { children: ReactNode }): JSX.Element {
	// Cover the screen to suppress react-dnd's return animation for outside drops.
	const dropRef = useTileDrop();
	const connectDropTarget = useCallback(
		(element: HTMLDivElement | null) => {
			dropRef(element);
		},
		[dropRef],
	);
	return (
		<div
			className="hanabi-responsive-game-surface min-h-screen w-full content-start"
			ref={connectDropTarget}
		>
			{children}
		</div>
	);
}
