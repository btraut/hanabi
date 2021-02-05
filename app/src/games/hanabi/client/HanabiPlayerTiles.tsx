import { useUserId } from 'app/src/components/SocketContext';
import { useHanabiGame } from 'app/src/games/hanabi/client/HanabiContext';
import { useHanabiHighlightTileContext } from 'app/src/games/hanabi/client/HanabiHighlightTileContext';
import HanabiInteractiveTileView from 'app/src/games/hanabi/client/HanabiInteractiveTileView';
import { useNewestTile } from 'app/src/games/hanabi/client/HanabiNewestTileContext';
import HanabiPlayerTilesDragLayer from 'app/src/games/hanabi/client/HanabiPlayerTilesDragLayer';
import { HANABI_BOARD_SIZE, HanabiTile } from 'app/src/games/hanabi/HanabiGameData';
import classnames from 'classnames';

interface Props {
	id: string;
	onTileClick?: (event: React.MouseEvent<HTMLDivElement>, tile: HanabiTile) => void;
}

export default function HanabiPlayerTiles({ id, onTileClick }: Props): JSX.Element {
	const game = useHanabiGame();
	const userId = useUserId();

	const { highlightedTiles } = useHanabiHighlightTileContext();
	const newestTileId = useNewestTile();

	const ownTiles = id === userId;
	const ownTurn = game.gameData.turnOrder[0] === userId;
	const thisPlayersTurn = game.gameData.turnOrder[0] === id;

	const player = game.gameData.players[id];
	const enableOnClick = ownTurn && onTileClick && (ownTiles || game.gameData.clues > 0);
	const gameStillPlaying = game.gameData.finishedReason === null;

	return (
		<div>
			<div
				className={classnames('border-4 border-black rounded-xl p-0.5', {
					'bg-red-100': thisPlayersTurn,
					'bg-white': !thisPlayersTurn,
				})}
			>
				<div style={HANABI_BOARD_SIZE} className="relative z-0">
					{player.tileLocations.map((tileLocation) => (
						<div
							key={`TileContainer-${tileLocation.tile.id}`}
							className={classnames('absolute top-0 left-0', {
								'duration-100': !ownTiles,
							})}
							style={{
								transform: `translate(${tileLocation.position.x}px, ${tileLocation.position.y}px)`,
								zIndex: tileLocation.tile.zIndex,
							}}
						>
							<HanabiInteractiveTileView
								tile={tileLocation.tile}
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
