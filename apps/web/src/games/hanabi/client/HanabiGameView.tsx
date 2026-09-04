import BreakpointController from '~/components/BreakpointController';
import HanabiBoard from '~/games/hanabi/client/HanabiBoard';
import HanabiDebugPanel from '~/games/hanabi/client/HanabiDebugPanel';
import { useGameData } from '~/games/hanabi/client/HanabiGameContext';
import HanabiHeader from '~/games/hanabi/client/HanabiHeader';
import HanabiHighlightTileController from '~/games/hanabi/client/HanabiHighlightController';
import HanabiLobby from '~/games/hanabi/client/HanabiLobby';
import HanabiReview from '~/games/hanabi/client/HanabiReview';
import { useUserId } from '~/components/SocketContext';
import useTileDrop from '~/games/hanabi/client/useTileDrop';
import { GameTranscriptV1, HanabiStage, isReplayableTranscript } from '@hanabi/shared';
import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

export default function HanabiGameView(): JSX.Element | null {
	const gameData = useGameData();
	const userId = useUserId();
	const [reviewTranscript, setReviewTranscript] = useState<GameTranscriptV1 | null>(null);
	const [reviewOpen, setReviewOpen] = useState(false);
	const canReview = isReplayableTranscript(gameData.reviewTranscript);
	const openReview = canReview
		? () => {
				setReviewTranscript(gameData.reviewTranscript!);
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

	// The entire screen should be used as a drop target. This is to work around a
	// limitation of react-dnd where the "return animation" is played when
	// dropping things outside drop targets.
	const dropRef = useTileDrop();
	const connectDropTarget = useCallback(
		(element: HTMLDivElement | null) => {
			dropRef(element);
		},
		[dropRef],
	);

	if (reviewOpen && reviewTranscript) {
		return (
			<HanabiReview
				key={reviewTranscript.roundId}
				transcript={reviewTranscript}
				userId={userId}
				onExit={() => setReviewOpen(false)}
				exitLabel={
					gameData.seed === reviewTranscript.roundId && gameData.stage === HanabiStage.Finished
						? 'Back to game'
						: 'Back to lobby'
				}
			/>
		);
	}

	return (
		<>
			{reviewTranscript && gameData.seed !== reviewTranscript.roundId && (
				<div className="mx-auto max-w-[1660px] px-5 py-3">
					<button className="hanabi-review-entry" type="button" onClick={() => setReviewOpen(true)}>
						Review previous game
					</button>
				</div>
			)}
			{gameData.stage === HanabiStage.Setup && <HanabiLobby />}
			{(gameData.stage === HanabiStage.Playing || gameData.stage === HanabiStage.Finished) && (
				<HanabiHighlightTileController>
					<BreakpointController>
						<div
							className="hanabi-responsive-game-surface min-h-screen w-full content-start"
							ref={connectDropTarget}
						>
							<HanabiHeader variant="game" />
							{gameData.stage === HanabiStage.Finished && (
								<div className="mx-auto flex max-w-[1660px] justify-end px-5 pt-3">
									{openReview ? (
										<button className="hanabi-review-entry" type="button" onClick={openReview}>
											Review game
										</button>
									) : (
										<p className="text-hanabi-text-muted">
											Review unavailable: this round has no complete transcript.
										</p>
									)}
								</div>
							)}
							<div className="hanabi-game-board-shell pt-5">
								<HanabiBoard
									onReview={openReview}
									initiallyDismissGameOver={reviewTranscript?.roundId === gameData.seed}
								/>
							</div>
							<div id="portal" />
						</div>
					</BreakpointController>
				</HanabiHighlightTileController>
			)}
			{showDebugPanel && <HanabiDebugPanel />}
		</>
	);
}
