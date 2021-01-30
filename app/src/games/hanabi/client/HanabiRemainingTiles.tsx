import { useHanabiGame } from 'app/src/games/hanabi/client/HanabiContext';
import HanabiTileView from 'app/src/games/hanabi/client/HanabiTileView';
import { HANABI_TILE_SIZE } from 'app/src/games/hanabi/HanabiGameData';

const TILE_OFFSET = 6;
const MAX_STACKED_TILES = 6;

interface Props {
	stack?: boolean;
}

export default function HanabiRemainingTiles({ stack = true }: Props): JSX.Element {
	const game = useHanabiGame();

	const remainingTiles = game.gameData.remainingTiles.length;
	const visibleRemainingTiles = stack ? Math.min(remainingTiles, MAX_STACKED_TILES) : 1;

	return (
		<div className="grid justify-start gap-1 relative grid-flow-col">
			<div
				className="absolute inset-0 flex justify-center items-center text-white text-xl"
				style={{ ...HANABI_TILE_SIZE, zIndex: visibleRemainingTiles + 1 }}
			>
				{remainingTiles}
			</div>
			<div
				className="relative"
				style={{
					width: (visibleRemainingTiles - 1) * TILE_OFFSET + HANABI_TILE_SIZE.width,
					height: HANABI_TILE_SIZE.height,
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
						<HanabiTileView hidden />
					</div>
				))}
			</div>
		</div>
	);
}
