import { useBreakpointContext } from 'app/src/components/BreakpointContext';
import { useUserId } from 'app/src/components/SocketContext';
import HanabiActions from 'app/src/games/hanabi/client/HanabiActions';
import HanabiClues from 'app/src/games/hanabi/client/HanabiClues';
import { useHanabiGame } from 'app/src/games/hanabi/client/HanabiContext';
import HanabiGameOverPopup from 'app/src/games/hanabi/client/HanabiGameOverPopup';
import HanabiLives from 'app/src/games/hanabi/client/HanabiLives';
import HanabiPlayedTiles, { PlayedTileSize } from 'app/src/games/hanabi/client/HanabiPlayedTiles';
import HanabiPlayerAvatar from 'app/src/games/hanabi/client/HanabiPlayerAvatar';
import HanabiPlayerTiles from 'app/src/games/hanabi/client/HanabiPlayerTiles';
import HanabiRemainingTiles from 'app/src/games/hanabi/client/HanabiRemainingTiles';
import HanabiTileActionsTooltip, {
	HanabiTileActionsTooltipOptions,
} from 'app/src/games/hanabi/client/HanabiTileActionsTooltip';
import { HanabiTile } from 'app/src/games/hanabi/HanabiGameData';
import useValueChanged from 'app/src/utils/client/useValueChanged';
import classnames from 'classnames';
import { Fragment, useCallback, useEffect, useState } from 'react';

function rotateArrayToItem<T>(arr: T[], item: T): T[] {
	const itemIndex = arr.indexOf(item);

	if (itemIndex === -1 || itemIndex === 0) {
		return arr;
	}

	return [...arr.slice(itemIndex), ...arr.slice(0, itemIndex)];
}

export default function HanabiBoard(): JSX.Element {
	const game = useHanabiGame();
	const userId = useUserId();

	const turnOrder = rotateArrayToItem(game.gameData.turnOrder, userId);

	const [showMenuForTile, setShowMenuForTile] = useState<{
		tile: HanabiTile;
		options: HanabiTileActionsTooltipOptions;
		coords: {
			top: number;
			left: number;
		};
	} | null>(null);

	const handleTileClick = useCallback(
		(event: React.MouseEvent<HTMLDivElement>, tile: HanabiTile) => {
			const rect = (event.target as any).getBoundingClientRect();
			const ownTile = !!game.gameData.players[userId].tileLocations.find(
				(tl) => tl.tile.id === tile.id,
			);

			setShowMenuForTile({
				tile,
				options: ownTile
					? HanabiTileActionsTooltipOptions.Own
					: HanabiTileActionsTooltipOptions.OtherPlayer,
				coords: {
					left: rect.x + rect.width / 2,
					top: rect.y + window.scrollY,
				},
			});
		},
		[game, userId],
	);

	const handleActionsTooltipAction = useCallback(
		(action: 'discard' | 'play' | 'color' | 'number', tile: HanabiTile) => {
			let tileOwner: string | null = null;

			for (const playerId in game.gameData.players) {
				if (game.gameData.players[playerId].tileLocations.find((tl) => tl.tile.id === tile.id)) {
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
					game.giveColorClue(tileOwner, tile.color);
					break;
				case 'number':
					game.giveNumberClue(tileOwner, tile.number);
					break;
			}

			setShowMenuForTile(null);
		},
		[game],
	);

	const handleActionsTooltipOnClose = useCallback(() => {
		setShowMenuForTile(null);
	}, []);

	const [showGameOverPopup, setShowGameOverPopup] = useState(!!game.gameData.finishedReason);
	const gameFinishedReasonChanged = useValueChanged(game.gameData.finishedReason);
	useEffect(() => {
		if (gameFinishedReasonChanged) {
			setShowGameOverPopup(!!game.gameData.finishedReason);
		}
	}, [gameFinishedReasonChanged, game.gameData.finishedReason]);

	const breakpoints = useBreakpointContext();

	return (
		<div className="grid grid-flow-row lg:grid-flow-col gap-6 relative">
			<div>
				<div
					className={classnames('border-4 border-black rounded-xl overflow-y-auto mb-6', {
						'bg-white': game.gameData.actions.length % 2 === 1,
						'bg-gray-200': game.gameData.actions.length % 2 === 0,
					})}
					style={{ height: 160 }}
				>
					<HanabiActions />
				</div>
				<div
					className="grid gap-y-6 content-start items-start"
					style={{ gridTemplateColumns: 'auto auto' }}
				>
					{turnOrder.map((playerId) => {
						const thisPlayersTurn =
							game.gameData.finishedReason === null && game.gameData.turnOrder[0] === playerId;

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
									<HanabiPlayerAvatar player={game.gameData.players[playerId]} size="sm" />
									{thisPlayersTurn && userId === playerId && (
										<p className="text-white italic whitespace-nowrap">Your turn!</p>
									)}
									{thisPlayersTurn && userId !== playerId && (
										<p className="text-white italic whitespace-nowrap">Waiting…</p>
									)}
								</div>
								<HanabiPlayerTiles
									id={playerId}
									onTileClick={game.gameData.finishedReason === null ? handleTileClick : undefined}
								/>
							</Fragment>
						);
					})}
				</div>
			</div>
			<div className="grid grid-flow-row gap-y-6 content-start">
				<div className="border-4 border-black bg-white rounded-xl p-4 grid grid-flow-row xl:grid-flow-col gap-2 xl:gap-4 justify-start items-center">
					<HanabiRemainingTiles />
					<HanabiClues />
					<HanabiLives />
				</div>
				<div className="border-4 border-black bg-white rounded-xl p-4 grid grid-flow-row gap-y-6">
					<HanabiPlayedTiles
						size={breakpoints.xl ? PlayedTileSize.Regular : PlayedTileSize.Small}
					/>
				</div>
			</div>

			{/* Popups */}
			{showMenuForTile && (
				<HanabiTileActionsTooltip
					coords={showMenuForTile.coords}
					tile={showMenuForTile.tile}
					options={showMenuForTile.options}
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
