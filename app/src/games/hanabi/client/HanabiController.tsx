import { useSocket } from 'app/src/components/SocketContext';
import { useGameManager } from 'app/src/games/client/GameManagerContext';
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
	const gameRef = useRef<HanabiGame | null>(null);
	const { socketManager, authSocketManager } = useSocket<HanabiMessage>();
	const gameManager = useGameManager();

	useEffect(() => {
		if (gameRef.current && gameRef.current !== game) {
			gameRef.current.cleanUp();
			gameRef.current = game;
		}
	}, [game]);

	const create = useCallback(async () => {
		const { id: gameId, code } = await gameManager.create(HANABI_GAME_TITLE);
		const newGame = new HanabiGame(gameId, code, socketManager, authSocketManager);
		await newGame.refreshGameData();
		setGame(newGame);

		return newGame;
	}, [authSocketManager, gameManager, socketManager]);

	const watch = useCallback(
		async (code: string) => {
			const { id: gameId } = await gameManager.watch(code);
			const newGame = new HanabiGame(gameId, code, socketManager, authSocketManager);
			await newGame.refreshGameData();
			setGame(newGame);

			return newGame;
		},
		[authSocketManager, gameManager, socketManager],
	);

	const contextValue = useMemo<HanabiContext>(
		() => ({
			create,
			watch,
			game,
		}),
		[create, game, watch],
	);

	return <HanabiContextProvider value={contextValue}>{children}</HanabiContextProvider>;
}
