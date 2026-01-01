import SocketManagerController from '~/components/SocketController';
import GameManagerController from '~/games/client/GameManagerController';
import HanabiGameController from '~/games/hanabi/client/HanabiGameController';
import HanabiOptionsController from '~/games/hanabi/client/HanabiOptionsController';
import HanabiRouter from '~/games/hanabi/client/HanabiRouter';
import HanabiStyles from '~/games/hanabi/client/HanabiStyles';
import Page from '~/pages/Page';
import useAudioUnlock from '~/utils/client/useAudioUnlock';
import useSetTitle from '~/utils/client/useSetTitle';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';

const title = 'Hanabi | Play';

const HanabiPage: Page = () => {
	useSetTitle(title);

	useAudioUnlock();

	return (
		<SocketManagerController>
			<GameManagerController>
				<HanabiOptionsController>
					<HanabiGameController>
						<DndProvider backend={HTML5Backend}>
							<HanabiStyles />
							<HanabiRouter />
						</DndProvider>
					</HanabiGameController>
				</HanabiOptionsController>
			</GameManagerController>
		</SocketManagerController>
	);
};

HanabiPage.title = title;

export default HanabiPage;
