import HanabiGameView from '~/games/hanabi/client/HanabiGameView';
import HanabiLoadGameView from '~/games/hanabi/client/HanabiLoadGameView';
import HanabiMainMenu from '~/games/hanabi/client/HanabiMainMenu';
import HanabiMoveTileController from '~/games/hanabi/client/HanabiMoveTileController';
import HanabiWatchForm from '~/games/hanabi/client/HanabiWatchForm';
import { Route, Switch } from 'react-router-dom';

export default function HanabiRouter(): JSX.Element {
	return (
		<Switch>
			<Route path="/" exact>
				<HanabiMainMenu />
			</Route>
			<Route path="/join" exact>
				<HanabiWatchForm />
			</Route>
			<Route path="/:code" exact>
				<HanabiLoadGameView>
					<HanabiMoveTileController>
						<HanabiGameView />
					</HanabiMoveTileController>
				</HanabiLoadGameView>
			</Route>
		</Switch>
	);
}
