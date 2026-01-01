import HanabiGameView from '~/games/hanabi/client/HanabiGameView';
import HanabiLoadGameView from '~/games/hanabi/client/HanabiLoadGameView';
import HanabiMainMenu from '~/games/hanabi/client/HanabiMainMenu';
import HanabiMoveTileController from '~/games/hanabi/client/HanabiMoveTileController';
import HanabiWatchForm from '~/games/hanabi/client/HanabiWatchForm';
import { Route, Routes } from 'react-router-dom';

export default function HanabiRouter(): JSX.Element {
	return (
		<Routes>
			<Route path="/" element={<HanabiMainMenu />} />
			<Route path="/join" element={<HanabiWatchForm />} />
			<Route
				path="/:code"
				element={
					<HanabiLoadGameView>
						<HanabiMoveTileController>
							<HanabiGameView />
						</HanabiMoveTileController>
					</HanabiLoadGameView>
				}
			/>
		</Routes>
	);
}
