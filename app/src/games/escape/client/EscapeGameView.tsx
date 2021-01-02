import EnsureGameLoaded from 'app/src/games/escape/client/EnsureGameLoaded';
import { Route, Switch } from 'react-router-dom';

import EscapeGameMenu from './EscapeGameMenu';
import EscapeGamePlayerView from './EscapeGamePlayerView';
import EscapeGameWatchForm from './EscapeGameWatchForm';

export default function EscapeGameView(): JSX.Element {
	return (
		<div className="EscapeGame-View">
			<div className="EscapeGame-Container">
				<h1 className="EscapeGame-Title">Escape!</h1>
				<Switch>
					<Route path="/escape/join" exact>
						<EscapeGameWatchForm />
					</Route>
					<Route path="/escape/:code" exact>
						<EnsureGameLoaded
							redirectUrl="/escape"
							fallback={<h1 className="EscapeGame-Subtitle">Loading…</h1>}
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
