import { useSocket } from 'app/src/components/SocketContext';
import { useGameManager } from 'app/src/games/client/GameManagerContext';
import HanabiAnimationManager from 'app/src/games/hanabi/client/HanabiAnimationManager';
import { HanabiContext, HanabiContextProvider } from 'app/src/games/hanabi/client/HanabiContext';
import HanabiGame from 'app/src/games/hanabi/client/HanabiGame';
import { HANABI_GAME_TITLE } from 'app/src/games/hanabi/HanabiGameData';
import { HanabiMessage } from 'app/src/games/hanabi/HanabiMessages';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

interface Props {
	readonly children: JSX.Element | JSX.Element[] | null;
}

export default function HanabiController({ children }: Props): JSX.Element {
	const [game, setGame] = useState<HanabiGame | null>(null);
	const [animationManager, setAnimationManager] = useState<HanabiAnimationManager | null>(null);
	const { socketManager, authSocketManager } = useSocket<HanabiMessage>();
	const gameManager = useGameManager();

	// If the game has changed, clean up the old one.
	const gameRef = useRef<HanabiGame | null>(game);
	useEffect(() => {
		if (gameRef.current && gameRef.current !== game) {
			gameRef.current.cleanUp();
			gameRef.current = game;
		}
	}, [game]);

	// If the animation manager has changed, clean up the old one.
	const animationManagerRef = useRef<HanabiAnimationManager | null>(animationManager);
	useEffect(() => {
		if (animationManagerRef.current && animationManagerRef.current !== animationManager) {
			animationManagerRef.current.cleanUp();
			animationManagerRef.current = animationManager;
		}
	}, [animationManager]);

	// Make a callback for creating a game. This will create the game on the
	// server, set the game as the current one here in the controller, and
	// update the animation manager.
	const create = useCallback(async () => {
		const { id: gameId, code } = await gameManager.create(HANABI_GAME_TITLE);
		const newGame = new HanabiGame(gameId, code, socketManager, authSocketManager);
		await newGame.refreshGameData();

		setGame(newGame);
		setAnimationManager(new HanabiAnimationManager(newGame));

		return newGame;
	}, [authSocketManager, gameManager, socketManager]);

	// Make a callback for watching a game. This will set the user as a watcher,
	// set the game as the current one here in the controller, and update the
	// animation manager.
	const watch = useCallback(
		async (code: string) => {
			const { id: gameId } = await gameManager.watch(code);
			const newGame = new HanabiGame(gameId, code, socketManager, authSocketManager);
			await newGame.refreshGameData();

			setGame(newGame);
			setAnimationManager(new HanabiAnimationManager(newGame));

			return newGame;
		},
		[authSocketManager, gameManager, socketManager],
	);

	// We're passing an array through context, so we must memoize for the sake
	// of stable rerenders.
	const contextValue = useMemo<HanabiContext>(
		() => ({
			create,
			watch,
			game,
			animationManager,
		}),
		[create, game, watch, animationManager],
	);

	return <HanabiContextProvider value={contextValue}>{children}</HanabiContextProvider>;
}
