import { useSocket } from 'app/src/components/SocketContext';
import { useGameManager } from 'app/src/games/client/GameManagerContext';
import { EscapeContext, EscapeContextProvider } from 'app/src/games/escape/client/EscapeContext';
import EscapeGame from 'app/src/games/escape/client/EscapeGame';
import { EscapeMessage } from 'app/src/games/escape/EscapeMessages';
import { ESCAPE_GAME_TITLE } from 'app/src/games/escape/EscapeRules';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

interface Props {
	readonly children: JSX.Element;
}

export default function EscapeController({ children }: Props): JSX.Element {
	const [game, setGame] = useState<EscapeGame | null>(null);
	const gameRef = useRef<EscapeGame | null>(null);
	const { socketManager, authSocketManager } = useSocket<EscapeMessage>();
	const gameManager = useGameManager();

	useEffect(() => {
		if (gameRef.current && gameRef.current !== game) {
			gameRef.current.cleanUp();
			gameRef.current = game;
		}
	}, [game]);

	const create = useCallback(async () => {
		const { id: gameId, code } = await gameManager.create(ESCAPE_GAME_TITLE);
		const newGame = new EscapeGame(gameId, code, socketManager, authSocketManager);
		await newGame.refreshGameData();
		setGame(newGame);

		return newGame;
	}, [authSocketManager, gameManager, socketManager]);

	const watch = useCallback(
		async (code: string) => {
			const { id: gameId } = await gameManager.watch(code);
			const newGame = new EscapeGame(gameId, code, socketManager, authSocketManager);
			await newGame.refreshGameData();
			setGame(newGame);

			return newGame;
		},
		[authSocketManager, gameManager, socketManager],
	);

	const contextValue = useMemo<EscapeContext>(
		() => ({
			create,
			watch,
			game,
		}),
		[create, game, watch],
	);

	return <EscapeContextProvider value={contextValue}>{children}</EscapeContextProvider>;
}
