import { useBreakpointContext } from 'app/src/components/BreakpointContext';
import { useUserId } from 'app/src/components/SocketContext';
import HanabiActions from 'app/src/games/hanabi/client/HanabiActions';
import HanabiActionsFilter from 'app/src/games/hanabi/client/HanabiActionsFilter';
import HanabiChatInput from 'app/src/games/hanabi/client/HanabiChatInput';
import HanabiClues from 'app/src/games/hanabi/client/HanabiClues';
import { useHanabiAnimationManager } from 'app/src/games/hanabi/client/HanabiContext';
import HanabiDiscardedTilesCollapsed from 'app/src/games/hanabi/client/HanabiDiscardedTilesCollapsed';
import HanabiGameOverPopup from 'app/src/games/hanabi/client/HanabiGameOverPopup';
import HanabiLives from 'app/src/games/hanabi/client/HanabiLives';
import HanabiPlayedTiles from 'app/src/games/hanabi/client/HanabiPlayedTiles';
import HanabiPlayedTilesCollapsed from 'app/src/games/hanabi/client/HanabiPlayedTilesCollapsed';
import HanabiPlayerAvatar from 'app/src/games/hanabi/client/HanabiPlayerAvatar';
import HanabiPlayerTiles from 'app/src/games/hanabi/client/HanabiPlayerTiles';
import HanabiRemainingTiles from 'app/src/games/hanabi/client/HanabiRemainingTiles';
import HanabiTileActionsTooltip from 'app/src/games/hanabi/client/HanabiTileActionsTooltip';
import HanabiTileNotesTooltip from 'app/src/games/hanabi/client/HanabiTileNotesTooltip';
import { TileViewSize } from 'app/src/games/hanabi/client/HanabiTileView';
import useLatestActions from 'app/src/games/hanabi/client/useLatestActions';
import useTileActionMenuHandlers from 'app/src/games/hanabi/client/useTileActionMenuHandlers';
import useTileNotesHandlers from 'app/src/games/hanabi/client/useTileNotesHandlers';
import { ActionsFilterOption } from 'app/src/games/hanabi/HanabiGameData';
import useValueChanged from 'app/src/utils/client/useValueChanged';
import classNames from 'classnames';
import { Fragment, useEffect, useRef, useState } from 'react';

function rotateArrayToItem<T>(arr: readonly T[], item: T): readonly T[] {
	const itemIndex = arr.indexOf(item);

	if (itemIndex === -1 || itemIndex === 0) {
		return arr;
	}

	return [...arr.slice(itemIndex), ...arr.slice(0, itemIndex)];
}

export default function HanabiBoard(): JSX.Element {
	const animationManager = useHanabiAnimationManager();
	const { displayGameData: gameData } = animationManager;

	const userId = useUserId();
	const userIsPlayer = !!(userId && gameData.players[userId]);

	const playerDisplayOrder = rotateArrayToItem(gameData.turnOrder, userId);

	const breakpoints = useBreakpointContext();

	// Build handlers and data pertaining to the action menu (clicks for tiles).
	const {
		showMenuForTile,
		handleTileClick,
		handleActionsTooltipAction,
		handleActionsTooltipOnClose,
	} = useTileActionMenuHandlers(gameData, userId);

	// Build handlers and data pertaining to the notes menu (hover for tiles).
	const {
		showNotesForTile,
		hideNotesForTile,
		handleTileMouseOver,
		handleTileMouseOut,
		handleTileMouseDown,
	} = useTileNotesHandlers(gameData);

	// Show the game over popup when the game ends for any reason.
	const [showGameOverPopup, setShowGameOverPopup] = useState(!!gameData.finishedReason);
	const gameFinishedReasonChanged = useValueChanged(gameData.finishedReason);
	useEffect(() => {
		if (gameFinishedReasonChanged) {
			setShowGameOverPopup(gameData.finishedReason !== null);
		}
	}, [gameFinishedReasonChanged, gameData.finishedReason]);

	// When a new action happens, scroll the actions container to the top.
	const latestActions = useLatestActions();
	const latestActionId = latestActions.length ? latestActions[latestActions.length - 1].id : null;
	const actionsContainerRef = useRef<HTMLDivElement | null>(null);
	useEffect(() => {
		if (latestActionId) {
			actionsContainerRef.current?.scrollTo(0, 0);
			hideNotesForTile();
		}
	}, [hideNotesForTile, latestActionId]);

	// Actions Filter:
	const [actionsFilter, setActionsFilter] = useState<ActionsFilterOption>('all');

	const actionsContainer = (
		<div
			className={classNames('grid border-4 border-black rounded-xl mb-6 overflow-hidden', {
				'bg-white': gameData.actions.length % 2 === 1,
				'bg-gray-200': gameData.actions.length % 2 === 0,
			})}
			style={{ maxHeight: breakpoints.lg ? 320 : 240, gridTemplateRows: 'auto 1fr auto' }}
			ref={actionsContainerRef}
		>
			<div className="border-solid border-gray-600 border-b-2 bg-gray-300">
				<HanabiActionsFilter filter={actionsFilter} onChange={setActionsFilter} />
			</div>
			<div className="overflow-y-auto">
				<HanabiActions filter={actionsFilter} />
			</div>
			{userIsPlayer && (
				<div className="border-solid border-gray-600 border-t-2 bg-gray-300">
					<HanabiChatInput />
				</div>
			)}
		</div>
	);

	return (
		<div className="grid grid-flow-row lg:grid-flow-col gap-6 relative">
			<div>
				{!breakpoints.lg && (
					<>
						{actionsContainer}
						<div className="grid grid-flow-row border-4 border-black bg-white rounded-xl p-4 gap-3 mb-6">
							<div className="grid grid-flow-col gap-2 justify-start">
								<HanabiRemainingTiles />
								<HanabiClues />
								<HanabiLives />
							</div>
							<HanabiPlayedTilesCollapsed />
							{gameData.discardedTiles.length > 0 && <HanabiDiscardedTilesCollapsed />}
						</div>
					</>
				)}

				<div
					className="pb-10 grid gap-y-6 content-start items-start"
					style={{ gridTemplateColumns: 'auto auto' }}
				>
					{playerDisplayOrder.map((playerId) => {
						const thisPlayersTurn =
							gameData.finishedReason === null && gameData.currentPlayerId === playerId;

						return (
							<Fragment key={`player-${playerId}`}>
								<div
									className={classNames('my-2 p-3 border-black border-4', {
										'bg-gray-800': !thisPlayersTurn,
										'bg-red-800': thisPlayersTurn,
									})}
									style={{
										borderTopLeftRadius: '0.75rem',
										borderBottomLeftRadius: '0.75rem',
										borderRightWidth: 0,
									}}
								>
									<HanabiPlayerAvatar player={gameData.players[playerId]} size="sm" />
									{thisPlayersTurn && userId === playerId && (
										<p className="text-white italic whitespace-nowrap">Your turn!</p>
									)}
									{thisPlayersTurn && userId !== playerId && (
										<p className="text-white italic whitespace-nowrap">Waiting…</p>
									)}
								</div>
								<HanabiPlayerTiles
									id={playerId}
									onTileClick={gameData.finishedReason === null ? handleTileClick : undefined}
									onTileMouseOver={
										gameData.showNotes && !showMenuForTile ? handleTileMouseOver : undefined
									}
									onTileMouseOut={
										gameData.showNotes && !showMenuForTile ? handleTileMouseOut : undefined
									}
									onTileMouseDown={
										gameData.showNotes && !showMenuForTile ? handleTileMouseDown : undefined
									}
								/>
							</Fragment>
						);
					})}
				</div>
			</div>
			{breakpoints.lg && (
				<div className="grid grid-flow-row gap-y-6 content-start">
					<div className="border-4 border-black bg-white rounded-xl p-4 grid grid-flow-row xl:grid-flow-col gap-2 xl:gap-4 justify-start items-center">
						<HanabiRemainingTiles />
						<HanabiClues />
						<HanabiLives />
					</div>
					<div className="border-4 border-black bg-white rounded-xl p-4 grid grid-flow-row gap-y-6">
						<HanabiPlayedTiles
							tileSize={breakpoints.xl ? TileViewSize.Regular : TileViewSize.Small}
							onTileMouseOver={
								gameData.showNotes && !showMenuForTile ? handleTileMouseOver : undefined
							}
							onTileMouseOut={
								gameData.showNotes && !showMenuForTile ? handleTileMouseOut : undefined
							}
						/>
					</div>
					{actionsContainer}
				</div>
			)}

			{/* Popups */}
			{showMenuForTile && (
				<HanabiTileActionsTooltip
					coords={showMenuForTile.coords}
					tileId={showMenuForTile.tileId}
					type={showMenuForTile.type}
					onAction={handleActionsTooltipAction}
					onClose={handleActionsTooltipOnClose}
				/>
			)}
			{showNotesForTile && !showMenuForTile && (
				<HanabiTileNotesTooltip notes={showNotesForTile.notes} coords={showNotesForTile.coords} />
			)}
			{showGameOverPopup && (
				<HanabiGameOverPopup
					onClose={() => {
						setShowGameOverPopup(false);
					}}
				/>
			)}
		</div>
	);
}
