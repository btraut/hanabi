import useEscapeGameManager from 'app/src/games/escape/client/useEscapeGameManager';
import useSocketManager from 'app/src/utils/client/useSocketManager';
import { Route, Switch } from 'react-router-dom';

import EscapeGameJoinForm from './EscapeGameJoinForm';
import EscapeGameMenu from './EscapeGameMenu';
import EscapeGamePlayerView from './EscapeGamePlayerView';

export default function EscapeGameView(): JSX.Element {
	const socketManager = useSocketManager();
	const gameManager = useEscapeGameManager(socketManager);

	return (
		<div className="EscapeGameView">
			<div className="EscapeGameView-Container">
				<h1 className="EscapeGameView-Title">Escape!</h1>
				<Switch>
					<Route path="/escape/join" exact>
						<EscapeGameJoinForm gameManager={gameManager} />
					</Route>
					<Route path="/escape/:code" exact>
						<EscapeGamePlayerView gameManager={gameManager} />
					</Route>
					<Route path="/escape" exact>
						<EscapeGameMenu gameManager={gameManager} />
					</Route>
				</Switch>
			</div>
		</div>
	);
}
