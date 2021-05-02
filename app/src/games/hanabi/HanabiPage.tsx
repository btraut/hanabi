import SocketManagerController from 'app/src/components/SocketController';
import GameManagerController from 'app/src/games/client/GameManagerController';
import HanabiController from 'app/src/games/hanabi/client/HanabiController';
import HanabiOptionsController from 'app/src/games/hanabi/client/HanabiOptionsController';
import HanabiRouter from 'app/src/games/hanabi/client/HanabiRouter';
import HanabiStyles from 'app/src/games/hanabi/client/HanabiStyles';
import Page from 'app/src/pages/Page';
import useAudioUnlock from 'app/src/utils/client/useAudioUnlock';
import useSetTitle from 'app/src/utils/client/useSetTitle';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';

const title = 'Hanabi | Play';

const HanabiPage: Page = () => {
	useSetTitle(title);

	useAudioUnlock();

	return (
		<SocketManagerController>
			<GameManagerController>
				<HanabiController>
					<HanabiOptionsController>
						<DndProvider backend={HTML5Backend}>
							<HanabiStyles />
							<HanabiRouter />
						</DndProvider>
					</HanabiOptionsController>
				</HanabiController>
			</GameManagerController>
		</SocketManagerController>
	);
};

HanabiPage.title = title;

export default HanabiPage;
