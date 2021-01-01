import { useEscapeGameManager } from 'app/src/games/escape/client/EscapeGameManagerContext';
import { useCallback } from 'react';
import { Route, Switch } from 'react-router-dom';

import EnsureGameLoaded from '../../client/EnsureGameLoaded';
import EscapeGameMenu from './EscapeGameMenu';
import EscapeGamePlayerView from './EscapeGamePlayerView';
import EscapeGameWatchForm from './EscapeGameWatchForm';

export default function EscapeGameView(): JSX.Element {
	const gameManager = useEscapeGameManager();

	const reloadData = useCallback(() => {
		return gameManager.refreshGameData();
	}, [gameManager]);

	return (
		<div className="EscapeGameView">
			<div className="EscapeGameView-Container">
				<h1 className="EscapeGameView-Title">Escape!</h1>
				<Switch>
					<Route path="/escape/join" exact>
						<EscapeGameWatchForm />
					</Route>
					<Route path="/escape/:code" exact>
						<EnsureGameLoaded
							gameManager={gameManager}
							fallbackUrl="/escape"
							reloadData={reloadData}
						>
							<EscapeGamePlayerView />
						</EnsureGameLoaded>
					</Route>
					<Route path="/escape" exact>
						<EscapeGameMenu />
					</Route>
				</Switch>
			</div>
		</div>
	);
}
