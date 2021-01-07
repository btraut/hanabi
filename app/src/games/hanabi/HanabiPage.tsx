import SocketManagerController from 'app/src/components/SocketController';
import GameManagerController from 'app/src/games/client/GameManagerController';
import HanabiController from 'app/src/games/hanabi/client/HanabiController';
import HanabiGameView from 'app/src/games/hanabi/client/HanabiRouter';
import Page from 'app/src/pages/Page';
import useSetTitle from 'app/src/utils/client/useSetTitle';

const title = 'Hanabi | Play';

const HanabiPage: Page = () => {
	useSetTitle(title);

	return (
		<SocketManagerController>
			<GameManagerController>
				<HanabiController>
					<HanabiGameView />
				</HanabiController>
			</GameManagerController>
		</SocketManagerController>
	);
};

HanabiPage.title = title;

export default HanabiPage;
