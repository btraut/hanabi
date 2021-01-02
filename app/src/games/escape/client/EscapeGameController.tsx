import { useSocketManager } from 'app/src/components/SocketManagerContext';
import { useGameManager } from 'app/src/games/client/GameManagerContext';
import EscapeGame from 'app/src/games/escape/client/EscapeGame';
import {
	EscapeGameContext,
	EscapeGameContextProvider,
} from 'app/src/games/escape/client/EscapeGameContext';
import { EscapeGameMessage } from 'app/src/games/escape/EscapeGameMessages';
import { ESCAPE_GAME_TITLE } from 'app/src/games/escape/EscapeGameRules';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

interface Props {
	readonly children: JSX.Element;
}

export default function EscapeGameController({ children }: Props): JSX.Element {
	const [game, setGame] = useState<EscapeGame | null>(null);
	const gameRef = useRef<EscapeGame | null>(null);
	const socketManager = useSocketManager<EscapeGameMessage>(false);
	const gameManager = useGameManager();

	useEffect(() => {
		if (gameRef.current && gameRef.current !== game) {
			gameRef.current.cleanUp();
			gameRef.current = game;
		}
	}, [game]);

	const create = useCallback(async () => {
		const { id: gameId, code } = await gameManager.create(ESCAPE_GAME_TITLE);
		const newGame = new EscapeGame(gameId, code, socketManager);
		await newGame.refreshGameData();
		setGame(newGame);

		return newGame;
	}, [gameManager, socketManager]);

	const watch = useCallback(
		async (code: string) => {
			const { id: gameId } = await gameManager.watch(code);
			const newGame = new EscapeGame(gameId, code, socketManager);
			await newGame.refreshGameData();
			setGame(newGame);

			return newGame;
		},
		[gameManager, socketManager],
	);

	const contextValue = useMemo<EscapeGameContext>(
		() => ({
			create,
			watch,
			game,
		}),
		[create, game, watch],
	);

	return <EscapeGameContextProvider value={contextValue}>{children}</EscapeGameContextProvider>;
}
