import { useHanabiGame } from 'app/src/games/hanabi/client/HanabiContext';
import HanabiTileView, { TileViewSize } from 'app/src/games/hanabi/client/HanabiTileView';
import { HANABI_TILE_SIZE_SMALL } from 'app/src/games/hanabi/HanabiGameData';

const TILE_OFFSET = 4;
const MAX_STACKED_TILES = 5;

export default function HanabiRemainingTiles(): JSX.Element {
	const game = useHanabiGame();

	const remainingTiles = game.gameData.remainingTiles.length;
	const visibleRemainingTiles = Math.min(remainingTiles, MAX_STACKED_TILES);

	return (
		<div className="grid justify-start gap-1 relative grid-flow-col">
			<div
				className="absolute inset-0 flex justify-center items-center text-white text-lg"
				style={{ ...HANABI_TILE_SIZE_SMALL, zIndex: visibleRemainingTiles + 1 }}
			>
				{remainingTiles}
			</div>
			<div
				className="relative"
				style={{
					width: (visibleRemainingTiles - 1) * TILE_OFFSET + HANABI_TILE_SIZE_SMALL.width,
					height: HANABI_TILE_SIZE_SMALL.height,
				}}
			>
				{new Array(visibleRemainingTiles).fill('').map((_, index) => (
					<div
						key={`remaining-${index}`}
						className="absolute"
						style={{
							left: index * TILE_OFFSET,
							zIndex: visibleRemainingTiles - index,
							top: 0,
							opacity: 1 - index / visibleRemainingTiles,
						}}
					>
						<HanabiTileView size={TileViewSize.Small} />
					</div>
				))}
			</div>
		</div>
	);
}
