import HanabiLoadGameView from 'app/src/games/hanabi/client/HanabiLoadGameView';
import HanabiMainMenu from 'app/src/games/hanabi/client/HanabiMainMenu';
import HanabiWatchForm from 'app/src/games/hanabi/client/HanabiWatchForm';
import { Route, Switch } from 'react-router-dom';

export default function HanabiRouter(): JSX.Element {
	return (
		<div className="w-screen min-h-screen flex flex-col justify-center items-center p-20">
			<h1 className="mb-10 text-8xl italic text-white text-center text-shadow">Hanabi</h1>
			<Switch>
				<Route path="/hanabi/join" exact>
					<HanabiWatchForm />
				</Route>
				<Route path="/hanabi/:code" exact>
					<HanabiLoadGameView />
				</Route>
				<Route path="/hanabi" exact>
					<HanabiMainMenu />
				</Route>
			</Switch>
		</div>
	);
}
