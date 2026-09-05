import { useSocket } from '~/components/SocketContext';
import { useGameManager } from '~/games/client/GameManagerContext';
import {
	HanabiGameContext,
	HanabiGameContextProvider,
} from '~/games/hanabi/client/HanabiGameContext';
import { HanabiGameStore } from './HanabiGameStore';
import HanabiGameMessenger from '~/games/hanabi/client/HanabiGameMessenger';
import { HANABI_GAME_TITLE } from '@hanabi/shared';
import { HanabiMessage } from '@hanabi/shared';
import { initializeGameMessenger } from './initializeGameMessenger';
import { useCallback, useEffect, useMemo, useState } from 'react';

interface Props {
	readonly children: JSX.Element | JSX.Element[] | null;
}

export default function HanabiGameController({ children }: Props): JSX.Element {
	// Game manager is used for watching or creating games.
	const gameManager = useGameManager();

	// Create storage for a game messenger. We'll create one once the user
	// watches or creates a game.
	const [session, setSession] = useState(() => ({
		store: new HanabiGameStore(),
		gameMessenger: null as HanabiGameMessenger | null,
		code: null as string | null,
	}));
	const { store, gameMessenger, code } = session;

	// Grab a socket connection to pass to the game messenger.
	const { socketManager, authSocketManager } = useSocket<HanabiMessage>();

	useEffect(() => () => gameMessenger?.cleanUp(), [gameMessenger]);

	// Make a callback for creating a game. This will create the game on the
	// server, set the game as the current one here in the controller.
	const create = useCallback(async () => {
		await socketManager.connect();
		await authSocketManager.authenticate();
		const { id: gameId, code: newCode } = await gameManager.create(HANABI_GAME_TITLE);
		const newStore = new HanabiGameStore();
		const newGameMessenger = new HanabiGameMessenger(
			gameId,
			socketManager,
			authSocketManager,
			newStore.receive,
		);
		await initializeGameMessenger(newGameMessenger);
		setSession({ code: newCode, store: newStore, gameMessenger: newGameMessenger });

		return newCode;
	}, [authSocketManager, gameManager, socketManager]);

	// Make a callback for watching a game. This will set the user as a watcher,
	// set the game as the current one here in the controller.
	const watch = useCallback(
		async (newCode: string) => {
			const { id: gameId } = await gameManager.watch(newCode);
			const newStore = new HanabiGameStore();
			const newGameMessenger = new HanabiGameMessenger(
				gameId,
				socketManager,
				authSocketManager,
				newStore.receive,
			);
			await initializeGameMessenger(newGameMessenger);
			setSession({ code: newCode, store: newStore, gameMessenger: newGameMessenger });
		},
		[authSocketManager, gameManager, socketManager],
	);

	// Session identity is stable across socket updates; data subscribers live in the store.
	const contextValue = useMemo<HanabiGameContext>(
		() => ({
			create,
			watch,
			gameMessenger,
			store,
			code,
		}),
		[create, watch, gameMessenger, store, code],
	);

	return <HanabiGameContextProvider value={contextValue}>{children}</HanabiGameContextProvider>;
}
