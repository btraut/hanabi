import { useUserId } from '~/components/SocketContext';
import HanabiActionEffects from '~/games/hanabi/client/HanabiActionEffects';
import HanabiLiveActivityRail from './HanabiLiveActivityRail';
import HanabiLiveDesktopStatus from './HanabiLiveDesktopStatus';
import HanabiLivePlayerWorkspace from './HanabiLivePlayerWorkspace';
import HanabiDesktopBoard from '~/games/hanabi/client/HanabiDesktopBoard';
import HanabiDesktopTableau from '~/games/hanabi/client/HanabiDesktopTableau';
import { useBoardData } from '~/games/hanabi/client/HanabiGameContext';
import { useTransitioningTileId } from '~/games/hanabi/client/HanabiGameContext';
import HanabiGameOverPopup from '~/games/hanabi/client/HanabiGameOverPopup';
import { useHanabiHighlightContext } from '~/games/hanabi/client/HanabiHighlightContext';
import { HanabiDesktopPlayerWorkspaces } from '~/games/hanabi/client/HanabiPlayerWorkspace';
import HanabiPlayerTiles from '~/games/hanabi/client/HanabiPlayerTiles';
import HanabiTileActionsTooltip from '~/games/hanabi/client/HanabiTileActionsTooltip';
import HanabiTileNotesTooltip from '~/games/hanabi/client/HanabiTileNotesTooltip';
import { HANABI_DRAG_TYPES } from '~/games/hanabi/client/HanabiDragTypes';
import { useLatestActionEffect } from '~/games/hanabi/client/useLatestActions';
import useTileActionMenuHandlers from '~/games/hanabi/client/useTileActionMenuHandlers';
import useTileNotesHandlers from '~/games/hanabi/client/useTileNotesHandlers';
import { HanabiGameAction } from '@hanabi/shared';
import useValueChanged from '~/utils/client/useValueChanged';
import { useCallback, useEffect, useState } from 'react';
import { useDragLayer } from 'react-dnd';

export function shouldShowTileOverlay<T>(overlay: T | null, isDraggingTile: boolean): overlay is T {
	return overlay !== null && !isDraggingTile;
}

export default function HanabiBoard({
	onReview,
	initiallyDismissGameOver = false,
}: {
	onReview?: () => void;
	initiallyDismissGameOver?: boolean;
}): JSX.Element {
	const gameData = useBoardData();
	const transitioningTileId = useTransitioningTileId();
	const userId = useUserId();
	const { highlightedTiles, highlightedTone } = useHanabiHighlightContext();

	const isDraggingTile = useDragLayer(
		(monitor) => monitor.isDragging() && monitor.getItemType() === HANABI_DRAG_TYPES.TILE,
	);

	// Build handlers and data pertaining to the action menu (clicks for tiles).
	const {
		showMenuForTile,
		handleTileClick,
		handleActionsTooltipAction,
		handleActionsTooltipOnClose,
	} = useTileActionMenuHandlers();

	// Build handlers and data pertaining to the notes menu (hover for tiles).
	const {
		showNotesForTile,
		hideNotesForTile,
		handleTileMouseOver,
		handleTileMouseOut,
		handleTileMouseDown,
		handleTileLongPress,
	} = useTileNotesHandlers();

	useEffect(() => {
		if (!isDraggingTile) return;
		handleActionsTooltipOnClose();
		hideNotesForTile();
	}, [handleActionsTooltipOnClose, hideNotesForTile, isDraggingTile]);

	useEffect(() => {
		const closeDetachedTileOverlays = () => {
			handleActionsTooltipOnClose();
			hideNotesForTile();
		};
		window.addEventListener('resize', closeDetachedTileOverlays);
		return () => window.removeEventListener('resize', closeDetachedTileOverlays);
	}, [handleActionsTooltipOnClose, hideNotesForTile]);

	// Show the game over popup when the game ends for any reason.
	const [showGameOverPopup, setShowGameOverPopup] = useState(
		!!gameData.finishedReason && !initiallyDismissGameOver,
	);
	const gameFinishedReasonChanged = useValueChanged(gameData.finishedReason);
	useEffect(() => {
		if (gameFinishedReasonChanged) {
			setShowGameOverPopup(gameData.finishedReason !== null);
		}
	}, [gameFinishedReasonChanged, gameData.finishedReason]);

	// When a new action happens, clear the note.
	useLatestActionEffect(
		useCallback(
			(latestAction: HanabiGameAction | null) => {
				if (latestAction) {
					hideNotesForTile();
				}
			},
			[hideNotesForTile],
		),
	);

	const handleTileActionClick = useCallback(
		(event: React.MouseEvent<HTMLElement>, tileId: string) => {
			hideNotesForTile();
			handleTileClick(event, tileId);
		},
		[handleTileClick, hideNotesForTile],
	);

	return (
		<>
			<HanabiActionEffects />
			<HanabiDesktopBoard
				activity={<HanabiLiveActivityRail />}
				status={<HanabiLiveDesktopStatus gameData={gameData} userId={userId} />}
				gameData={gameData}
				playerWorkspaces={
					<HanabiDesktopPlayerWorkspaces
						workspaceComponent={HanabiLivePlayerWorkspace}
						gameData={gameData}
						renderTileSurface={(playerId) => (
							<HanabiPlayerTiles
								id={playerId}
								onTileClick={gameData.finishedReason === null ? handleTileActionClick : undefined}
								onTileMouseDown={
									gameData.showNotes && !showMenuForTile && !isDraggingTile
										? handleTileMouseDown
										: undefined
								}
								onTileLongPress={
									gameData.showNotes && !showMenuForTile && !isDraggingTile
										? handleTileLongPress
										: undefined
								}
								onTileMouseOut={
									gameData.showNotes && !showMenuForTile && !isDraggingTile
										? handleTileMouseOut
										: undefined
								}
								onTileMouseOver={
									gameData.showNotes && !showMenuForTile && !isDraggingTile
										? handleTileMouseOver
										: undefined
								}
								variant="desktop"
							/>
						)}
						userId={userId}
					/>
				}
				tableau={
					<HanabiDesktopTableau
						gameData={gameData}
						highlightedTiles={highlightedTiles}
						highlightedTone={highlightedTone ?? undefined}
						transitioningTileId={transitioningTileId}
					/>
				}
				userId={userId}
			/>
			{shouldShowTileOverlay(showMenuForTile, isDraggingTile) && (
				<HanabiTileActionsTooltip
					coords={showMenuForTile.coords}
					tileId={showMenuForTile.tileId}
					type={showMenuForTile.type}
					onAction={handleActionsTooltipAction}
					onClose={handleActionsTooltipOnClose}
				/>
			)}
			{shouldShowTileOverlay(showNotesForTile, isDraggingTile) && !showMenuForTile && (
				<HanabiTileNotesTooltip
					notes={showNotesForTile.notes}
					coords={showNotesForTile.coords}
					onClose={hideNotesForTile}
				/>
			)}
			{showGameOverPopup && (
				<HanabiGameOverPopup
					onReview={onReview}
					onClose={() => {
						setShowGameOverPopup(false);
					}}
				/>
			)}
		</>
	);
}
