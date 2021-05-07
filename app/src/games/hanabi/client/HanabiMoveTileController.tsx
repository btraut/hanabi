import { useUserId } from 'app/src/components/SocketContext';
import { useGameData, useGameMessenger } from 'app/src/games/hanabi/client/HanabiGameContext';
import {
	HanabiMoveTileContext,
	HanabiMoveTileContextProvider,
} from 'app/src/games/hanabi/client/HanabiMoveTileContext';
import { Position } from 'app/src/games/hanabi/HanabiGameData';
import { useCallback, useEffect, useMemo, useState } from 'react';

interface Props {
	readonly children: JSX.Element | JSX.Element[] | null;
}

export default function HanabiMoveTileController({ children }: Props): JSX.Element {
	const gameData = useGameData();
	const gameMessenger = useGameMessenger();
	const userId = useUserId();

	const [positionOverrides, setPositionOverrides] = useState<{ [tileId: string]: Position }>({});

	const moveTiles = useCallback(
		async (positions: { [tileId: string]: Position }, commit: boolean) => {
			setPositionOverrides(positions);

			if (commit) {
				await gameMessenger.moveTiles(positions);
			}
		},
		[gameMessenger],
	);

	// Merge the official tilePositions with the overrides.
	const mergedTilePositions = useMemo(
		() => ({
			...gameData.tilePositions,
			...positionOverrides,
		}),
		[gameData.tilePositions, positionOverrides],
	);

	// If our tiles ever change, it's time to blow away our local overrides.
	useEffect(() => {
		if (gameData.playerTiles[userId]) {
			const overrideTileIds = Object.keys(positionOverrides);
			const playerTileIdsSet = new Set(gameData.playerTiles[userId]);

			let allTilesAccountedFor = true;

			for (const overrideTileId of overrideTileIds) {
				if (!playerTileIdsSet.has(overrideTileId)) {
					allTilesAccountedFor = false;
					break;
				}
			}

			if (!allTilesAccountedFor) {
				setPositionOverrides({});
			}
		}
	}, [gameData.playerTiles, positionOverrides, userId]);

	// We're passing an array through context, so we must memoize for the sake
	// of stable rerenders.
	const contextValue = useMemo<HanabiMoveTileContext>(
		() => ({
			moveTiles,
			tilePositions: mergedTilePositions,
		}),
		[moveTiles, mergedTilePositions],
	);

	return (
		<HanabiMoveTileContextProvider value={contextValue}>{children}</HanabiMoveTileContextProvider>
	);
}
