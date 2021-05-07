import { useSocket } from 'app/src/components/SocketContext';
import { useGameManager } from 'app/src/games/client/GameManagerContext';
import {
	HanabiGameContext,
	HanabiGameContextProvider,
} from 'app/src/games/hanabi/client/HanabiGameContext';
import HanabiGameMessenger from 'app/src/games/hanabi/client/HanabiGameMessenger';
import { HANABI_GAME_TITLE, HanabiGameData } from 'app/src/games/hanabi/HanabiGameData';
import { HanabiMessage } from 'app/src/games/hanabi/HanabiMessages';
import { useCallback, useEffect, useMemo, useState } from 'react';

interface Props {
	readonly children: JSX.Element | JSX.Element[] | null;
}

export default function HanabiGameController({ children }: Props): JSX.Element {
	// Game manager is used for watching or creating games.
	const gameManager = useGameManager();

	// Create storage for a game messenger. We'll create one once the user
	// watches or creates a game.
	const [gameMessenger, setGameMessenger] = useState<HanabiGameMessenger | null>(null);

	// Grab a socket connection to pass to the game messenger.
	const { socketManager, authSocketManager } = useSocket<HanabiMessage>();

	// Create storage for game data. This will always be the most up-to-date
	// mirror from the server, and any augmentation such as local edits or
	// animations should be done down-stream.
	const [gameData, setGameData] = useState<HanabiGameData | null>(null);

	// If the game messenger has changed, clean up the old one.
	useEffect(() => () => gameMessenger?.cleanUp(), [gameMessenger]);

	// Make a callback for creating a game. This will create the game on the
	// server, set the game as the current one here in the controller.
	const create = useCallback(async () => {
		const { id: gameId, code } = await gameManager.create(HANABI_GAME_TITLE);
		const newGameMessenger = new HanabiGameMessenger(
			gameId,
			code,
			socketManager,
			authSocketManager,
			setGameData,
		);
		await newGameMessenger.refreshGameData();

		setGameMessenger(newGameMessenger);

		return newGameMessenger;
	}, [authSocketManager, gameManager, socketManager]);

	// Make a callback for watching a game. This will set the user as a watcher,
	// set the game as the current one here in the controller.
	const watch = useCallback(
		async (code: string) => {
			const { id: gameId } = await gameManager.watch(code);
			const newGameMessenger = new HanabiGameMessenger(
				gameId,
				code,
				socketManager,
				authSocketManager,
				setGameData,
			);
			await newGameMessenger.refreshGameData();

			setGameMessenger(newGameMessenger);

			return newGameMessenger;
		},
		[authSocketManager, gameManager, socketManager],
	);

	// We're passing an array through context, so we must memoize for the sake
	// of stable rerenders.
	const contextValue = useMemo<HanabiGameContext>(
		() => ({
			create,
			watch,
			gameMessenger,
			gameData,
		}),
		[create, gameMessenger, watch, gameData],
	);

	return <HanabiGameContextProvider value={contextValue}>{children}</HanabiGameContextProvider>;
}
