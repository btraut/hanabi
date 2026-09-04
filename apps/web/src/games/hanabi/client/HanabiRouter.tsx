import HanabiGameView from '~/games/hanabi/client/HanabiGameView';
import HanabiLoadGameView from '~/games/hanabi/client/HanabiLoadGameView';
import HanabiMainMenu from '~/games/hanabi/client/HanabiMainMenu';
import HanabiMoveTileController from '~/games/hanabi/client/HanabiMoveTileController';
import HanabiWatchForm from '~/games/hanabi/client/HanabiWatchForm';
import HanabiDesktopFixtureView from '~/games/hanabi/client/dev/HanabiDesktopFixtureView';
import HanabiReviewFixtureView from '~/games/hanabi/client/dev/HanabiReviewFixtureView';
import Error404Page from '~/pages/Error404Page';
import { Route, Routes } from 'react-router-dom';

export default function HanabiRouter(): JSX.Element {
	return (
		<Routes>
			<Route path="/" element={<HanabiMainMenu />} />
			<Route path="/join" element={<HanabiWatchForm />} />
			<Route
				path="/dev/review"
				element={import.meta.env.DEV ? <HanabiReviewFixtureView /> : <Error404Page />}
			/>
			<Route
				path="/dev/desktop/:fixture"
				element={import.meta.env.DEV ? <HanabiDesktopFixtureView /> : <Error404Page />}
			/>
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
			<Route path="*" element={<Error404Page />} />
		</Routes>
	);
}
