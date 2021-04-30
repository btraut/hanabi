import { useUserId } from 'app/src/components/SocketContext';
import { useHanabiAnimationManager } from 'app/src/games/hanabi/client/HanabiContext';
import { useHanabiHighlightContext } from 'app/src/games/hanabi/client/HanabiHighlightContext';
import HanabiInteractiveTileView from 'app/src/games/hanabi/client/HanabiInteractiveTileView';
import { useNewestTile } from 'app/src/games/hanabi/client/HanabiNewestTileContext';
import HanabiPlayerTilesDragLayer from 'app/src/games/hanabi/client/HanabiPlayerTilesDragLayer';
import useJustTookAction from 'app/src/games/hanabi/client/useJustTookAction';
import { HANABI_BOARD_SIZE, HanabiTile } from 'app/src/games/hanabi/HanabiGameData';
import classnames from 'classnames';
import { useDragLayer } from 'react-dnd';

interface Props {
	id: string;
	onTileClick?: (event: React.MouseEvent<HTMLDivElement>, tile: HanabiTile) => void;
}

export default function HanabiPlayerTiles({ id, onTileClick }: Props): JSX.Element {
	const animationManager = useHanabiAnimationManager();
	const { displayGameData: gameData } = animationManager;
	const userId = useUserId();

	const { highlightedTiles } = useHanabiHighlightContext();
	const newestTileId = useNewestTile();

	const ownTiles = id === userId;
	const ownTurn = gameData.currentPlayerId === userId;

	const player = gameData.players[id];
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
					{player.tileLocations.map((tileLocation) => (
						<div
							key={`TileContainer-${tileLocation.tile.id}`}
							className={classnames('absolute top-0 left-0', {
								'duration-100': !ownTiles || isDragging || justTookAction,
							})}
							style={{
								transform: `translate(${tileLocation.position.x}px, ${tileLocation.position.y}px)`,
								zIndex: tileLocation.position.z,
							}}
						>
							<HanabiInteractiveTileView
								tileLocation={tileLocation}
								hidden={gameStillPlaying && ownTiles}
								onClick={enableOnClick ? onTileClick : undefined}
								draggable={gameStillPlaying && ownTiles}
								highlight={highlightedTiles.has(tileLocation.tile.id)}
								enableNewAnimation={gameStillPlaying && tileLocation.tile.id === newestTileId}
							/>
						</div>
					))}
					{gameStillPlaying && ownTiles && <HanabiPlayerTilesDragLayer />}
				</div>
			</div>
		</div>
	);
}
