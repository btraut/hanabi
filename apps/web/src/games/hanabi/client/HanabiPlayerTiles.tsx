import { useUserId } from '~/components/SocketContext';
import { useGameData } from '~/games/hanabi/client/HanabiGameContext';
import { useHanabiHighlightContext } from '~/games/hanabi/client/HanabiHighlightContext';
import HanabiInteractiveTileView from '~/games/hanabi/client/HanabiInteractiveTileView';
import { useHanabiMoveTileContext } from '~/games/hanabi/client/HanabiMoveTileContext';
import HanabiPlayerTilesDragLayer from '~/games/hanabi/client/HanabiPlayerTilesDragLayer';
import useJustTookAction from '~/games/hanabi/client/useJustTookAction';
import { HANABI_BOARD_SIZE } from '@hanabi/shared';
import classNames from 'classnames';
import { useDragLayer } from 'react-dnd';

interface Props {
	id: string;
	onTileClick?: (event: React.MouseEvent<HTMLDivElement>, tileId: string) => void;
	onTileMouseOver?: (event: React.MouseEvent<HTMLDivElement>, tileId: string) => void;
	onTileMouseOut?: (event: React.MouseEvent<HTMLDivElement>, tileId: string) => void;
	onTileMouseDown?: (event: React.MouseEvent<HTMLDivElement>, tileId: string) => void;
}

export default function HanabiPlayerTiles({
	id,
	onTileClick,
	onTileMouseOver,
	onTileMouseOut,
	onTileMouseDown,
}: Props): JSX.Element {
	const gameData = useGameData();
	const userId = useUserId();
	const { tilePositions } = useHanabiMoveTileContext();

	const { highlightedTiles } = useHanabiHighlightContext();

	const ownTiles = id === userId;
	const ownTurn = gameData.currentPlayerId === userId;

	const enableOnClick = ownTurn && onTileClick;
	const gameStillPlaying = gameData.finishedReason === null;

	const { isDragging } = useDragLayer((monitor) => ({
		isDragging: monitor.isDragging(),
	}));

	const justTookAction = useJustTookAction();

	return (
		<div className="border-4 border-black rounded-xl p-0.5 bg-white relative">
			{gameData.allowDragging && (
				<div className="absolute bottom-0 left-0 right-0 h-1/2 bg-black opacity-5" />
			)}
			<div style={HANABI_BOARD_SIZE} className="relative z-0">
				{gameData.playerTiles[id].map((tileId) => (
					<div
						key={`TileContainer-${tileId}`}
						className={classNames('absolute top-0 left-0', {
							'duration-100': !ownTiles || isDragging || justTookAction,
						})}
						style={{
							transform: `translate(${tilePositions[tileId].x}px, ${tilePositions[tileId].y}px)`,
							zIndex: tilePositions[tileId].z,
						}}
					>
						<HanabiInteractiveTileView
							tile={gameData.tiles[tileId]}
							hidden={gameStillPlaying && ownTiles}
							onClick={enableOnClick ? onTileClick : undefined}
							onMouseOver={onTileMouseOver}
							onMouseOut={onTileMouseOut}
							onMouseDown={onTileMouseDown}
							draggable={gameData.allowDragging && gameStillPlaying && ownTiles}
							notesIndicator={
								gameStillPlaying && ownTiles && gameData.showNotes && !!gameData.tileNotes[tileId]
							}
							highlight={highlightedTiles.has(tileId)}
						/>
					</div>
				))}
				{gameStillPlaying && ownTiles && <HanabiPlayerTilesDragLayer />}
			</div>
		</div>
	);
}
