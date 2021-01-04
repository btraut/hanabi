import EscapeLoadGameView from 'app/src/games/escape/client/EscapeLoadGameView';
import EscapeMainMenu from 'app/src/games/escape/client/EscapeMainMenu';
import EscapeWatchForm from 'app/src/games/escape/client/EscapeWatchForm';
import { Route, Switch } from 'react-router-dom';

export default function EscapeRouter(): JSX.Element {
	return (
		<div className="Escape-View">
			<div className="Escape-Container">
				<h1 className="Escape-Title">Escape!</h1>
				<Switch>
					<Route path="/escape/join" exact>
						<EscapeWatchForm />
					</Route>
					<Route path="/escape/:code" exact>
						<EscapeLoadGameView />
					</Route>
					<Route path="/escape" exact>
						<EscapeMainMenu />
					</Route>
				</Switch>
			</div>
		</div>
	);
}
