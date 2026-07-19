import { useUserId } from '~/components/SocketContext';
import { useGameData, useTransitioningTileId } from '~/games/hanabi/client/HanabiGameContext';
import { useHanabiHighlightContext } from '~/games/hanabi/client/HanabiHighlightContext';
import HanabiInteractiveTileView from '~/games/hanabi/client/HanabiInteractiveTileView';
import { useHanabiMoveTileContext } from '~/games/hanabi/client/HanabiMoveTileContext';
import { getTileViewTransitionName } from '~/games/hanabi/client/HanabiActionTransition';
import HanabiPlayerTilesDragLayer from '~/games/hanabi/client/HanabiPlayerTilesDragLayer';
import useJustTookAction from '~/games/hanabi/client/useJustTookAction';
import { HANABI_BOARD_SIZE, HANABI_WORKSPACE_ZONE_BOUNDARY, HanabiGameData } from '@hanabi/shared';
import classNames from 'classnames';
import { useDragLayer } from 'react-dnd';

interface Props {
	id: string;
	variant?: 'desktop' | 'legacy';
	onTileClick?: (event: React.MouseEvent<HTMLElement>, tileId: string) => void;
	onTileMouseOver?: (event: React.MouseEvent<HTMLElement>, tileId: string) => void;
	onTileMouseOut?: (event: React.MouseEvent<HTMLElement>, tileId: string) => void;
	onTileMouseDown?: (event: React.MouseEvent<HTMLElement>, tileId: string) => void;
}

export function getHanabiPlayerTilePermissions({
	gameData,
	isTransitioning,
	playerId,
	userId,
}: {
	gameData: Pick<HanabiGameData, 'allowDragging' | 'currentPlayerId' | 'finishedReason'>;
	isTransitioning: boolean;
	playerId: string;
	userId: string;
}): { canAct: boolean; draggable: boolean; hidden: boolean; ownTiles: boolean } {
	const ownTiles = playerId === userId;
	const gameStillPlaying = gameData.finishedReason === null;
	return {
		canAct: gameStillPlaying && ownTiles && gameData.currentPlayerId === userId,
		draggable: !isTransitioning && gameData.allowDragging && gameStillPlaying && ownTiles,
		hidden: gameStillPlaying && ownTiles,
		ownTiles,
	};
}

export default function HanabiPlayerTiles({
	id,
	variant = 'legacy',
	onTileClick,
	onTileMouseOver,
	onTileMouseOut,
	onTileMouseDown,
}: Props): JSX.Element {
	const gameData = useGameData();
	const transitioningTileId = useTransitioningTileId();
	const userId = useUserId();
	const { tilePositions } = useHanabiMoveTileContext();

	const { highlightedTiles } = useHanabiHighlightContext();

	const gameStillPlaying = gameData.finishedReason === null;

	const { isDragging } = useDragLayer((monitor) => ({
		isDragging: monitor.isDragging(),
	}));

	const justTookAction = useJustTookAction();

	return (
		<div
			className={classNames('relative overflow-hidden', {
				'border-4 border-black rounded-xl p-0.5 bg-white': variant === 'legacy',
				'bg-hanabi-ivory': variant === 'desktop',
			})}
		>
			{gameData.allowDragging && (
				<div
					aria-hidden="true"
					className={classNames('absolute bottom-0 left-0 right-0 border-t', {
						'border-black/10 bg-black/5': variant === 'legacy',
						'border-hanabi-border/35 bg-hanabi-ink/8': variant === 'desktop',
					})}
					style={{ height: HANABI_BOARD_SIZE.height - HANABI_WORKSPACE_ZONE_BOUNDARY }}
				/>
			)}
			<div style={HANABI_BOARD_SIZE} className="relative z-0">
				{gameData.playerTiles[id].map((tileId, index) => {
					const isTransitioning = transitioningTileId === tileId;
					const permissions = getHanabiPlayerTilePermissions({
						gameData,
						isTransitioning,
						playerId: id,
						userId,
					});

					return (
						<div
							key={`TileContainer-${tileId}`}
							className={classNames('absolute top-0 left-0', {
								'duration-100': !permissions.ownTiles || isDragging || justTookAction,
							})}
							style={{
								transform: `translate(${tilePositions[tileId].x}px, ${tilePositions[tileId].y}px)`,
								zIndex: tilePositions[tileId].z,
							}}
						>
							<HanabiInteractiveTileView
								tile={gameData.tiles[tileId]}
								ariaLabel={
									permissions.ownTiles
										? `Your tile ${index + 1}`
										: `${gameData.players[id].name}'s tile ${index + 1}`
								}
								hidden={permissions.hidden}
								onClick={permissions.canAct ? onTileClick : undefined}
								onMouseOver={isTransitioning ? undefined : onTileMouseOver}
								onMouseOut={isTransitioning ? undefined : onTileMouseOut}
								onMouseDown={isTransitioning ? undefined : onTileMouseDown}
								draggable={permissions.draggable}
								notesIndicator={
									!isTransitioning &&
									gameStillPlaying &&
									permissions.ownTiles &&
									gameData.showNotes &&
									!!gameData.tileNotes[tileId]
								}
								highlight={!isTransitioning && highlightedTiles.has(tileId)}
								viewTransitionName={isTransitioning ? getTileViewTransitionName(tileId) : undefined}
							/>
						</div>
					);
				})}
				{gameStillPlaying && id === userId && <HanabiPlayerTilesDragLayer />}
			</div>
		</div>
	);
}
