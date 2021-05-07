// The user may potentially deep-link to this page. If so, we need to make sure
// we load the game. This requires waiting for a socket connection to be
// made/authenticated and then the game to be loaded. In the meantime, we'll
// display a loading screen. All components that are children of EnsureGameLoaded
// will assume that hanabiContext.game is populated.

import { useSocket } from 'app/src/components/SocketContext';
import EnsureGameLoaded from 'app/src/games/client/EnsureGameLoaded';
import { useHanabiGameContext } from 'app/src/games/hanabi/client/HanabiGameContext';
import { useCallback } from 'react';
import { useParams } from 'react-router';

interface Props {
	children: JSX.Element;
}

export default function HanabiLoadGameView({ children }: Props): JSX.Element | null {
	const hanabiGameContext = useHanabiGameContext();
	const { authSocketManager, socketManager } = useSocket();

	const { code = '' } = useParams<{ code?: string }>();
	const loadGameHandler = useCallback(async () => {
		await socketManager.connect();
		await authSocketManager.authenticate();
		await hanabiGameContext.watch(code);
	}, [authSocketManager, code, hanabiGameContext, socketManager]);

	return (
		<EnsureGameLoaded
			redirectUrl="/"
			gameLoaded={!!hanabiGameContext.gameData}
			fallback={
				<div className="w-screen min-h-screen p-20 grid content-center justify-center">
					<h1 className="text-3xl italic text-white">Loading…</h1>
				</div>
			}
			loadGameHandler={loadGameHandler}
		>
			{children}
		</EnsureGameLoaded>
	);
}
