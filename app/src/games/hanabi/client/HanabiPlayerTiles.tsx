import { useUserId } from 'app/src/components/SocketContext';
import { useHanabiAnimationManager } from 'app/src/games/hanabi/client/HanabiContext';
import { useHanabiHighlightContext } from 'app/src/games/hanabi/client/HanabiHighlightContext';
import HanabiInteractiveTileView from 'app/src/games/hanabi/client/HanabiInteractiveTileView';
import HanabiPlayerTilesDragLayer from 'app/src/games/hanabi/client/HanabiPlayerTilesDragLayer';
import useJustTookAction from 'app/src/games/hanabi/client/useJustTookAction';
import { HANABI_BOARD_SIZE } from 'app/src/games/hanabi/HanabiGameData';
import classNames from 'classnames';
import { useDragLayer } from 'react-dnd';

interface Props {
	id: string;
	onTileClick?: (event: React.MouseEvent<HTMLDivElement>, tileId: string) => void;
	onTileMouseOver?: (event: React.MouseEvent<HTMLDivElement>, tileId: string) => void;
	onTileMouseOut?: (event: React.MouseEvent<HTMLDivElement>, tileId: string) => void;
}

export default function HanabiPlayerTiles({
	id,
	onTileClick,
	onTileMouseOver,
	onTileMouseOut,
}: Props): JSX.Element {
	const animationManager = useHanabiAnimationManager();
	const { displayGameData: gameData } = animationManager;
	const userId = useUserId();

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
		<div>
			<div className="border-4 border-black rounded-xl p-0.5 bg-white relative">
				<div className="absolute bottom-0 left-0 right-0 h-1/2 bg-black opacity-5" />
				<div style={HANABI_BOARD_SIZE} className="relative z-0">
					{gameData.playerTiles[id].map((tileId) => (
						<div
							key={`TileContainer-${tileId}`}
							className={classNames('absolute top-0 left-0', {
								'duration-100': !ownTiles || isDragging || justTookAction,
							})}
							style={{
								transform: `translate(${gameData.tilePositions[tileId].x}px, ${gameData.tilePositions[tileId].y}px)`,
								zIndex: gameData.tilePositions[tileId].z,
							}}
						>
							<HanabiInteractiveTileView
								tile={gameData.tiles[tileId]}
								position={gameData.tilePositions[tileId]}
								hidden={gameStillPlaying && ownTiles}
								onClick={enableOnClick ? onTileClick : undefined}
								onMouseOver={onTileMouseOver}
								onMouseOut={onTileMouseOut}
								draggable={gameStillPlaying && ownTiles}
								highlight={highlightedTiles.has(tileId)}
							/>
						</div>
					))}
					{gameStillPlaying && ownTiles && <HanabiPlayerTilesDragLayer />}
				</div>
			</div>
		</div>
	);
}
