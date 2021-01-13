import { useSocket } from 'app/src/components/SocketContext';
import HanabiClues from 'app/src/games/hanabi/client/HanabiClues';
import { useHanabiGame } from 'app/src/games/hanabi/client/HanabiContext';
import HanabiLives from 'app/src/games/hanabi/client/HanabiLives';
import HanabiPlayedTiles from 'app/src/games/hanabi/client/HanabiPlayedTiles';
import HanabiPlayerTiles from 'app/src/games/hanabi/client/HanabiPlayerTiles';
import HanabiTileActionsTooltip from 'app/src/games/hanabi/client/HanabiTileActionsTooltip';
import { HanabiTile } from 'app/src/games/hanabi/HanabiGameData';
import { useCallback, useState } from 'react';

function rotateArrayToItem<T>(arr: T[], item: T): T[] {
	const itemIndex = arr.indexOf(item);

	if (itemIndex === -1 || itemIndex === 0) {
		return arr;
	}

	return [...arr.slice(itemIndex), ...arr.slice(0, itemIndex)];
}

export default function HanabiBoard(): JSX.Element {
	const { userId } = useSocket();
	const game = useHanabiGame();

	if (!game || !userId) {
		throw new Error('Must connect/join. This should never happen.');
	}

	const turnOrder = rotateArrayToItem(game.gameData.turnOrder, userId);

	const [showMenuForTile, setShowMenuForTile] = useState<{
		tile: HanabiTile;
		ownTile: boolean;
		coords: {
			top: number;
			left: number;
		};
	} | null>(null);
	const handleTileClick = useCallback(
		(event: React.MouseEvent<HTMLDivElement>, tile: HanabiTile, ownTile: boolean) => {
			const rect = (event.target as any).getBoundingClientRect();
			setShowMenuForTile({
				tile,
				ownTile,
				coords: {
					left: rect.x + rect.width / 2,
					top: rect.y + window.scrollY,
				},
			});
		},
		[],
	);

	const handleActionsTooltipAction = useCallback(
		(action: 'discard' | 'play' | 'color' | 'number', tile: HanabiTile) => {
			console.log(action, tile);
			setShowMenuForTile(null);
		},
		[],
	);

	const handleActionsTooltipOnClose = useCallback(() => {
		setShowMenuForTile(null);
	}, []);

	return (
		<div className="grid grid-flow-col gap-x-10">
			<div>
				{game.gameData.turnOrder.map((id, index) => (
					<div className={index < turnOrder.length - 1 ? 'mb-10' : ''} key={`player-${id}`}>
						<HanabiPlayerTiles id={id} onTileClick={handleTileClick} />
					</div>
				))}
			</div>
			<div>
				<p className="text-xl text-white pl-2">Board:</p>
				<div className="border-4 border-solid border-black bg-white p-4 grid grid-flow-row gap-y-4">
					<HanabiClues />
					<HanabiPlayedTiles />
					<div className="py-1">
						<HanabiLives />
					</div>
				</div>
			</div>
			{showMenuForTile && (
				<HanabiTileActionsTooltip
					coords={showMenuForTile.coords}
					tile={showMenuForTile.tile}
					ownTile={showMenuForTile.ownTile}
					onAction={handleActionsTooltipAction}
					onClose={handleActionsTooltipOnClose}
				/>
			)}
		</div>
	);
}
