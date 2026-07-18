import { useSocket } from '~/components/SocketContext';
import { useGameManager } from '~/games/client/GameManagerContext';
import {
	HanabiGameContext,
	HanabiGameContextProvider,
} from '~/games/hanabi/client/HanabiGameContext';
import { HanabiActionTransitionCoordinator } from '~/games/hanabi/client/HanabiActionTransition';
import HanabiGameMessenger from '~/games/hanabi/client/HanabiGameMessenger';
import { HANABI_GAME_TITLE, HanabiGameData } from '@hanabi/shared';
import { HanabiMessage } from '@hanabi/shared';
import { initializeGameMessenger } from './initializeGameMessenger';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';

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
	const [transitioningTileId, setTransitioningTileId] = useState<string | null>(null);
	const actionTransitionCoordinatorRef =
		useRef<HanabiActionTransitionCoordinator<HanabiGameData>>(null);
	if (actionTransitionCoordinatorRef.current === null) {
		actionTransitionCoordinatorRef.current = new HanabiActionTransitionCoordinator({
			applyState: (nextGameData, tileId) => {
				flushSync(() => {
					setTransitioningTileId(tileId);
					setGameData(nextGameData);
				});
			},
			markTransitioningTile: (tileId) => {
				flushSync(() => {
					setTransitioningTileId(tileId);
				});
			},
			clearTransitioningTile: () => {
				setTransitioningTileId(null);
			},
			prefersReducedMotion: () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
			startTransition:
				'startViewTransition' in document
					? (update) => document.startViewTransition(update)
					: undefined,
		});
	}

	const updateGameData = useCallback((nextGameData: HanabiGameData) => {
		actionTransitionCoordinatorRef.current?.update(nextGameData);
	}, []);

	// Store the code of the loaded game.
	const [code, setCode] = useState<string | null>(null);

	// If the game messenger has changed, clean up the old one.
	useEffect(() => () => gameMessenger?.cleanUp(), [gameMessenger]);
	useEffect(
		() => () => {
			actionTransitionCoordinatorRef.current?.cleanUp();
		},
		[],
	);

	// Make a callback for creating a game. This will create the game on the
	// server, set the game as the current one here in the controller.
	const create = useCallback(async () => {
		await socketManager.connect();
		await authSocketManager.authenticate();
		const { id: gameId, code: newCode } = await gameManager.create(HANABI_GAME_TITLE);
		const newGameMessenger = new HanabiGameMessenger(
			gameId,
			socketManager,
			authSocketManager,
			updateGameData,
		);
		await initializeGameMessenger(newGameMessenger);
		setCode(newCode);

		setGameMessenger(newGameMessenger);

		return newCode;
	}, [authSocketManager, gameManager, socketManager, updateGameData]);

	// Make a callback for watching a game. This will set the user as a watcher,
	// set the game as the current one here in the controller.
	const watch = useCallback(
		async (newCode: string) => {
			const { id: gameId } = await gameManager.watch(newCode);
			const newGameMessenger = new HanabiGameMessenger(
				gameId,
				socketManager,
				authSocketManager,
				updateGameData,
			);
			await initializeGameMessenger(newGameMessenger);
			setCode(newCode);

			setGameMessenger(newGameMessenger);
		},
		[authSocketManager, gameManager, socketManager, updateGameData],
	);

	// We're passing an array through context, so we must memoize for the sake
	// of stable rerenders.
	const contextValue = useMemo<HanabiGameContext>(
		() => ({
			create,
			watch,
			gameMessenger,
			gameData,
			transitioningTileId,
			code,
		}),
		[create, watch, gameMessenger, gameData, transitioningTileId, code],
	);

	return <HanabiGameContextProvider value={contextValue}>{children}</HanabiGameContextProvider>;
}
