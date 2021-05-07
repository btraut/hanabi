import { useGameData } from 'app/src/games/hanabi/client/HanabiContext';
import HanabiTileView, { TileViewSize } from 'app/src/games/hanabi/client/HanabiTileView';
import { HANABI_TILE_SIZE_SMALL } from 'app/src/games/hanabi/HanabiGameData';
import mapXTimes from 'app/src/utils/mapXTimes';
import classNames from 'classnames';

const TILE_OFFSET = 4;
const MAX_STACKED_TILES = 5;

export default function HanabiRemainingTiles(): JSX.Element {
	const gameData = useGameData();

	const remainingTiles = gameData.remainingTiles.length;
	const visibleRemainingTiles = Math.min(remainingTiles, MAX_STACKED_TILES);

	return (
		<div className="grid justify-start gap-1 relative grid-flow-col z-0 select-none cursor-default">
			<div
				className={classNames('absolute inset-0 flex justify-center items-center text-lg', {
					'text-white': visibleRemainingTiles,
					'text-black': !visibleRemainingTiles,
				})}
				style={{ ...HANABI_TILE_SIZE_SMALL, zIndex: visibleRemainingTiles + 1 }}
			>
				{remainingTiles}
			</div>
			{visibleRemainingTiles ? (
				<div
					className="relative"
					style={{
						width: (visibleRemainingTiles - 1) * TILE_OFFSET + HANABI_TILE_SIZE_SMALL.width,
						height: HANABI_TILE_SIZE_SMALL.height,
					}}
				>
					{mapXTimes(visibleRemainingTiles, (index) => (
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
			) : (
				<div
					className="rounded-md border-dashed border-black border-2"
					style={HANABI_TILE_SIZE_SMALL}
				/>
			)}
		</div>
	);
}
