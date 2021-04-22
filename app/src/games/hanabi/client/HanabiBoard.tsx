import { useBreakpointContext } from 'app/src/components/BreakpointContext';
import { useUserId } from 'app/src/components/SocketContext';
import HanabiActions from 'app/src/games/hanabi/client/HanabiActions';
import HanabiClues from 'app/src/games/hanabi/client/HanabiClues';
import {
	useHanabiAnimationManager,
	useHanabiGame,
} from 'app/src/games/hanabi/client/HanabiContext';
import HanabiDiscardedTilesCollapsed from 'app/src/games/hanabi/client/HanabiDiscardedTilesCollapsed';
import HanabiGameOverPopup from 'app/src/games/hanabi/client/HanabiGameOverPopup';
import HanabiLives from 'app/src/games/hanabi/client/HanabiLives';
import HanabiPlayedTiles from 'app/src/games/hanabi/client/HanabiPlayedTiles';
import HanabiPlayedTilesCollapsed from 'app/src/games/hanabi/client/HanabiPlayedTilesCollapsed';
import HanabiPlayerAvatar from 'app/src/games/hanabi/client/HanabiPlayerAvatar';
import HanabiPlayerTiles from 'app/src/games/hanabi/client/HanabiPlayerTiles';
import HanabiRemainingTiles from 'app/src/games/hanabi/client/HanabiRemainingTiles';
import HanabiTileActionsTooltip, {
	HanabiTileActionsTooltipType,
} from 'app/src/games/hanabi/client/HanabiTileActionsTooltip';
import { TileViewSize } from 'app/src/games/hanabi/client/HanabiTileView';
import useLatestActions from 'app/src/games/hanabi/client/useLatestActions';
import { HanabiGameAction, HanabiTile, HanabiTileColor } from 'app/src/games/hanabi/HanabiGameData';
import useValueChanged from 'app/src/utils/client/useValueChanged';
import classnames from 'classnames';
import { Fragment, useCallback, useEffect, useRef, useState } from 'react';

function rotateArrayToItem<T>(arr: T[], item: T): T[] {
	const itemIndex = arr.indexOf(item);

	if (itemIndex === -1 || itemIndex === 0) {
		return arr;
	}

	return [...arr.slice(itemIndex), ...arr.slice(0, itemIndex)];
}

export default function HanabiBoard(): JSX.Element {
	const game = useHanabiGame();
	const animationManager = useHanabiAnimationManager();
	const { displayGameData: gameData } = animationManager;

	const userId = useUserId();

	const turnOrder = rotateArrayToItem(gameData.turnOrder, userId);

	const [showMenuForTile, setShowMenuForTile] = useState<{
		tile: HanabiTile;
		type: HanabiTileActionsTooltipType;
		coords: {
			top: number;
			left: number;
		};
	} | null>(null);

	const handleTileClick = useCallback(
		(event: React.MouseEvent<HTMLDivElement>, tile: HanabiTile) => {
			const rect = (event.target as any).getBoundingClientRect();
			const ownTile = !!gameData.players[userId].tileLocations.find((tl) => tl.tile.id === tile.id);

			// What menu should we display?
			let type = ownTile
				? HanabiTileActionsTooltipType.Own
				: HanabiTileActionsTooltipType.OtherPlayer;
			if (gameData.clues === 0 && !ownTile) {
				type = HanabiTileActionsTooltipType.NoClues;
			}

			setShowMenuForTile({
				tile,
				type,
				coords: {
					left: rect.x + rect.width / 2,
					top: rect.y + window.scrollY,
				},
			});
		},
		[gameData, userId],
	);

	const handleActionsTooltipAction = useCallback(
		(
			action: 'discard' | 'play' | 'color' | 'number',
			tile: HanabiTile,
			details?: { color?: HanabiTileColor },
		) => {
			let tileOwner: string | null = null;

			for (const playerId in gameData.players) {
				if (gameData.players[playerId].tileLocations.find((tl) => tl.tile.id === tile.id)) {
					tileOwner = playerId;
					break;
				}
			}

			if (!tileOwner) {
				throw new Error('Invalid tile. No owner found.');
			}

			switch (action) {
				case 'discard':
					game.discardTile(tile);
					break;
				case 'play':
					game.playTile(tile);
					break;
				case 'color':
					game.giveColorClue(tileOwner, details?.color ?? tile.color);
					break;
				case 'number':
					game.giveNumberClue(tileOwner, tile.number);
					break;
			}

			setShowMenuForTile(null);
		},
		[game, gameData],
	);

	const handleActionsTooltipOnClose = useCallback(() => {
		setShowMenuForTile(null);
	}, []);

	// Show the game over popup when the game ends for any reason.
	const [showGameOverPopup, setShowGameOverPopup] = useState(!!gameData.finishedReason);
	const gameFinishedReasonChanged = useValueChanged(gameData.finishedReason);
	useEffect(() => {
		if (gameFinishedReasonChanged) {
			setShowGameOverPopup(gameData.finishedReason !== null);
		}
	}, [gameFinishedReasonChanged, gameData.finishedReason]);

	const breakpoints = useBreakpointContext();

	// When a new action happens, scroll the actions container to the top.
	const latestActions = useLatestActions();
	const latestAction = latestActions.length ? latestActions[latestActions.length - 1] : null;
	const latestHandledActionRef = useRef<HanabiGameAction | null>(null);
	const actionsContainerRef = useRef<HTMLDivElement | null>(null);
	useEffect(() => {
		if (latestHandledActionRef.current !== latestAction) {
			latestHandledActionRef.current = latestAction;
			actionsContainerRef.current?.scrollTo(0, 0);
		}
	}, [latestAction]);

	return (
		<div className="grid grid-flow-row lg:grid-flow-col gap-6 relative">
			<div>
				{!breakpoints.lg && (
					<>
						<div
							className={classnames('border-4 border-black rounded-xl overflow-y-auto mb-6', {
								'bg-white': gameData.actions.length % 2 === 1,
								'bg-gray-200': gameData.actions.length % 2 === 0,
							})}
							style={{ maxHeight: 160 }}
							ref={actionsContainerRef}
						>
							<HanabiActions />
						</div>
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
					className="grid gap-y-6 content-start items-start"
					style={{ gridTemplateColumns: 'auto auto' }}
				>
					{turnOrder.map((playerId) => {
						const thisPlayersTurn =
							gameData.finishedReason === null && gameData.turnOrder[0] === playerId;

						return (
							<Fragment key={`player-${playerId}`}>
								<div
									className={classnames('my-4 p-3 border-black border-4 transition-all', {
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
						/>
					</div>
					<div
						className={classnames('border-4 border-black rounded-xl overflow-y-auto mb-6', {
							'bg-white': gameData.actions.length % 2 === 1,
							'bg-gray-200': gameData.actions.length % 2 === 0,
						})}
						style={{ maxHeight: 320 }}
						ref={actionsContainerRef}
					>
						<HanabiActions />
					</div>
				</div>
			)}

			{/* Popups */}
			{showMenuForTile && (
				<HanabiTileActionsTooltip
					coords={showMenuForTile.coords}
					tile={showMenuForTile.tile}
					type={showMenuForTile.type}
					onAction={handleActionsTooltipAction}
					onClose={handleActionsTooltipOnClose}
				/>
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
