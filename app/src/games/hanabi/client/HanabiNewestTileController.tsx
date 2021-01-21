import { useUserId } from 'app/src/components/SocketContext';
import { useHanabiGame } from 'app/src/games/hanabi/client/HanabiContext';
import { HanabiNewestTileContextProvider } from 'app/src/games/hanabi/client/HanabiNewestTileContext';
import { HanabiGameData, HanabiStage } from 'app/src/games/hanabi/HanabiGameData';
import { useCallback, useEffect, useRef, useState } from 'react';

interface Props {
	readonly children: JSX.Element | JSX.Element[] | null;
}

export default function HanabiNewestTileController({ children }: Props): JSX.Element {
	const game = useHanabiGame();
	const userId = useUserId();

	const gameOnUpdateSubscriptionIdRef = useRef<number | null>(null);

	const gameDataRef = useRef<HanabiGameData>(game.gameData);

	const [newestTileId, setNewestTileId] = useState<string | null>(null);

	const handleUpdate = useCallback(() => {
		const previousGameData = gameDataRef.current;
		const previousTiles = previousGameData.players[userId].tileLocations.map((tl) => tl.tile);
		const newTiles = game.gameData.players[userId].tileLocations.map((tl) => tl.tile);

		gameDataRef.current = game.gameData;

		if (game.gameData.stage !== HanabiStage.Playing) {
			return;
		}

		if (
			newTiles[newTiles.length - 1].id !== previousTiles[previousTiles.length - 1].id &&
			previousGameData.stage === HanabiStage.Playing
		) {
			setNewestTileId(newTiles[newTiles.length - 1].id);
		}
	}, [game, userId]);

	// Subscribe to updates.
	useEffect(() => {
		gameOnUpdateSubscriptionIdRef.current = game.onUpdate.subscribe(handleUpdate);

		return () => {
			game.onUpdate.unsubscribe(gameOnUpdateSubscriptionIdRef.current!);
			gameOnUpdateSubscriptionIdRef.current = null;
		};
	}, [handleUpdate, game]);

	return (
		<HanabiNewestTileContextProvider value={newestTileId}>
			{children}
		</HanabiNewestTileContextProvider>
	);
}
