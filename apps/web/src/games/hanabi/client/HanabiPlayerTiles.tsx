import { useUserId } from '~/components/SocketContext';
import { useGameData, useTransitioningTileId } from '~/games/hanabi/client/HanabiGameContext';
import {
	HANABI_DESKTOP_SURFACE_HEIGHT,
	HANABI_DESKTOP_ZONE_HEIGHT,
	getHanabiDesktopTileStyle,
	getHanabiDesktopTileVisualDimensions,
} from '~/games/hanabi/client/HanabiDesktopTileGeometry';
import { useHanabiHighlightContext } from '~/games/hanabi/client/HanabiHighlightContext';
import HanabiInteractiveTileView from '~/games/hanabi/client/HanabiInteractiveTileView';
import { useHanabiMoveTileContext } from '~/games/hanabi/client/HanabiMoveTileContext';
import { getTileViewTransitionName } from '~/games/hanabi/client/HanabiActionTransition';
import HanabiPlayerTilesDragLayer from '~/games/hanabi/client/HanabiPlayerTilesDragLayer';
import { HanabiDragTypes, getHanabiPositionForDrag } from '~/games/hanabi/client/HanabiDragTypes';
import useJustTookAction from '~/games/hanabi/client/useJustTookAction';
import {
	HANABI_BOARD_SIZE,
	HANABI_WORKSPACE_ZONE_BOUNDARY,
	HanabiGameData,
	Position,
	getNewPositionsForTiles,
} from '@hanabi/shared';
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
		canAct: gameStillPlaying && gameData.currentPlayerId === userId,
		draggable: !isTransitioning && gameData.allowDragging && gameStillPlaying && ownTiles,
		hidden: gameStillPlaying && ownTiles,
		ownTiles,
	};
}

export function hasHanabiTileNotes(
	notes: HanabiGameData['tileNotes'][string] | undefined,
): boolean {
	return Boolean(notes && (notes.colors.length > 0 || notes.numbers.length > 0));
}

export function shouldShowHanabiPlayerTileEmphasis(
	highlighted: boolean,
	tileId: string,
	draggedTileId: string | undefined,
): boolean {
	return highlighted && tileId !== draggedTileId;
}

export function getHanabiResponsivePreviewPositions({
	draggedPosition,
	draggedTileId,
	playerTileIds,
	tilePositions,
}: {
	draggedPosition: Position | null;
	draggedTileId: string | undefined;
	playerTileIds: readonly string[];
	tilePositions: { readonly [tileId: string]: Position };
}): Record<string, Position> | null {
	if (!draggedTileId || !draggedPosition || !playerTileIds.includes(draggedTileId)) return null;

	const otherTilePositions: Record<string, Position> = {};
	for (const tileId of playerTileIds) {
		if (tileId !== draggedTileId) otherTilePositions[tileId] = tilePositions[tileId];
	}

	return getNewPositionsForTiles({ [draggedTileId]: draggedPosition }, otherTilePositions, false);
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

	const { highlightedAction, highlightedTiles, highlightedTone } = useHanabiHighlightContext();

	const gameStillPlaying = gameData.finishedReason === null;

	const { dragDelta, dragItem, isDragging } = useDragLayer((monitor) => ({
		dragDelta: monitor.getDifferenceFromInitialOffset(),
		dragItem: monitor.getItem<HanabiDragTypes>(),
		isDragging: monitor.isDragging(),
	}));
	const draggedPosition =
		dragItem && dragDelta ? getHanabiPositionForDrag(dragItem, dragDelta) : null;
	const responsivePreviewPositions =
		variant === 'desktop'
			? getHanabiResponsivePreviewPositions({
					draggedPosition,
					draggedTileId: dragItem?.id,
					playerTileIds: gameData.playerTiles[id],
					tilePositions: gameData.tilePositions,
				})
			: null;

	const justTookAction = useJustTookAction();

	return (
		<div
			className={classNames('hanabi-player-tile-surface relative overflow-hidden', {
				'border-4 border-black rounded-xl p-0.5 bg-white': variant === 'legacy',
				'bg-hanabi-table/25': variant === 'desktop',
			})}
		>
			{gameData.allowDragging && (
				<div
					aria-hidden="true"
					className={classNames('absolute bottom-0 left-0 right-0 border-t', {
						'border-black/10 bg-black/5': variant === 'legacy',
						'border-hanabi-border bg-hanabi-table-deep/18': variant === 'desktop',
					})}
					style={
						variant === 'desktop'
							? { bottom: 0, top: HANABI_DESKTOP_ZONE_HEIGHT }
							: { height: HANABI_BOARD_SIZE.height - HANABI_WORKSPACE_ZONE_BOUNDARY }
					}
				/>
			)}
			<div
				style={
					variant === 'desktop'
						? { height: HANABI_DESKTOP_SURFACE_HEIGHT, width: '100%' }
						: HANABI_BOARD_SIZE
				}
				className="hanabi-player-board relative z-0"
			>
				{gameData.playerTiles[id].map((tileId, index) => {
					const displayedPosition = responsivePreviewPositions?.[tileId] ?? tilePositions[tileId];
					const isTransitioning = transitioningTileId === tileId;
					const permissions = getHanabiPlayerTilePermissions({
						gameData,
						isTransitioning,
						playerId: id,
						userId,
					});
					const highlighted = !isTransitioning && highlightedTiles.has(tileId);
					const visualDimensions = getHanabiDesktopTileVisualDimensions(permissions.hidden);

					return (
						<div
							key={`TileContainer-${tileId}`}
							className={classNames('absolute top-0 left-0', {
								'duration-100': !permissions.ownTiles || isDragging || justTookAction,
							})}
							style={{
								...(variant === 'desktop'
									? getHanabiDesktopTileStyle({
											hidden: permissions.hidden,
											position: displayedPosition,
											tileCount: gameData.playerTiles[id].length,
										})
									: {
											transform: `translate(${displayedPosition.x}px, ${displayedPosition.y}px)`,
										}),
								zIndex: displayedPosition.z,
							}}
						>
							<div className={variant === 'desktop' ? 'hanabi-player-tile' : undefined}>
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
									dimensions={variant === 'desktop' ? visualDimensions : undefined}
									notesIndicator={
										!isTransitioning &&
										gameStillPlaying &&
										permissions.ownTiles &&
										gameData.showNotes &&
										hasHanabiTileNotes(gameData.tileNotes[tileId])
									}
									highlight={variant === 'legacy' && highlighted}
									highlightTone={highlightedTone ?? 'action'}
									dragHighlight={highlighted}
									responsiveDragSurface={variant === 'desktop'}
									viewTransitionName={
										isTransitioning ? getTileViewTransitionName(tileId) : undefined
									}
								/>
							</div>
							{variant === 'desktop' &&
								shouldShowHanabiPlayerTileEmphasis(
									highlighted,
									tileId,
									isDragging ? dragItem?.id : undefined,
								) && (
									<span
										aria-hidden="true"
										className={`hanabi-player-tile-emphasis hanabi-tile-emphasis-${highlightedTone ?? 'action'} pointer-events-none absolute left-0 top-0 z-20 rounded-lg`}
										key={`highlight-${highlightedAction}-${tileId}`}
										style={{
											height: visualDimensions.height,
											width: visualDimensions.width,
										}}
									/>
								)}
						</div>
					);
				})}
				{gameStillPlaying && id === userId && <HanabiPlayerTilesDragLayer variant={variant} />}
			</div>
		</div>
	);
}
