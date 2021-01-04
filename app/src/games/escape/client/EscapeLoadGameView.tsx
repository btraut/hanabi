// The user may potentially deep-link to this page. If so, we need to make sure
// we load the game. This requires waiting for a socket connection to be
// made/authenticated and then the game to be loaded. In the meantime, we'll
// display a loading screen. All components that are children of EnsureGameLoaded
// will assume that escapeContext.game is populated.

import EnsureGameLoaded from 'app/src/games/client/EnsureGameLoaded';
import { useEscapeContext } from 'app/src/games/escape/client/EscapeContext';
import EscapeGameView from 'app/src/games/escape/client/EscapeGameView';
import { useCallback } from 'react';
import { useParams } from 'react-router';

export default function EscapeLoadGameView(): JSX.Element | null {
	const escapeContext = useEscapeContext();

	const { code = '' } = useParams<{ code?: string }>();
	const loadGameHandler = useCallback(async () => {
		// TODO: Make sure socket is connected/authenticated.

		await escapeContext.watch(code);
	}, [code, escapeContext]);

	return (
		<EnsureGameLoaded
			game={escapeContext.game}
			redirectUrl="/escape"
			fallback={<h1 className="Escape-Subtitle">Loading…</h1>}
			loadGameHandler={loadGameHandler}
		>
			<EscapeGameView />
		</EnsureGameLoaded>
	);
}
