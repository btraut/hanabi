// The user may potentially deep-link to this page. If so, we need to make sure
// we load the game. This requires waiting for a socket connection to be
// made/authenticated and then the game to be loaded. In the meantime, we'll
// display a loading screen. All components that are children of EnsureGameLoaded
// will assume that hanabiContext.game is populated.

import { useSocket } from 'app/src/components/SocketContext';
import EnsureGameLoaded from 'app/src/games/client/EnsureGameLoaded';
import { useHanabiContext } from 'app/src/games/hanabi/client/HanabiContext';
import HanabiGameView from 'app/src/games/hanabi/client/HanabiGameView';
import { useCallback } from 'react';
import { useParams } from 'react-router';

export default function HanabiLoadGameView(): JSX.Element | null {
	const hanabiContext = useHanabiContext();
	const { authSocketManager } = useSocket();

	const { code = '' } = useParams<{ code?: string }>();
	const loadGameHandler = useCallback(async () => {
		await authSocketManager.authenticate();
		await hanabiContext.watch(code);
	}, [authSocketManager, code, hanabiContext]);

	return (
		<EnsureGameLoaded
			game={hanabiContext.game}
			redirectUrl="/hanabi"
			fallback={<h1 className="Hanabi-Subtitle">Loading…</h1>}
			loadGameHandler={loadGameHandler}
		>
			<HanabiGameView />
		</EnsureGameLoaded>
	);
}
