import { useUserId } from 'app/src/components/SocketContext';
import { useHanabiGame } from 'app/src/games/hanabi/client/HanabiContext';
import { HanabiNewestTileContextProvider } from 'app/src/games/hanabi/client/HanabiNewestTileContext';
import { HanabiGameData, HanabiStage } from 'app/src/games/hanabi/HanabiGameData';
import useIsMounted from 'app/src/utils/client/useMounted';
import { useCallback, useEffect, useRef, useState } from 'react';

interface Props {
	readonly children: JSX.Element | JSX.Element[] | null;
}

export default function HanabiNewestTileController({ children }: Props): JSX.Element {
	const game = useHanabiGame();
	const userId = useUserId();
	const isMounted = useIsMounted();

	const gameOnUpdateSubscriptionIdRef = useRef<number | null>(null);

	const gameDataRef = useRef<HanabiGameData>(game.gameData);

	const [newestTileId, setNewestTileId] = useState<string | null>(null);

	const handleUpdate = useCallback(() => {
		if (!isMounted()) {
			return;
		}

		const previousGameData = gameDataRef.current;
		const previousTileIds = previousGameData.playerTiles[userId];
		const newTileIds = game.gameData.playerTiles[userId];

		gameDataRef.current = game.gameData;

		if (game.gameData.stage !== HanabiStage.Playing) {
			return;
		}

		if (
			newTileIds[newTileIds.length - 1] !== previousTileIds[previousTileIds.length - 1] &&
			previousGameData.stage === HanabiStage.Playing
		) {
			setNewestTileId(newTileIds[newTileIds.length - 1]);
		}
	}, [game.gameData, isMounted, userId]);

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
