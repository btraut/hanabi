import SocketManagerController from '~/components/SocketController';
import GameManagerController from '~/games/client/GameManagerController';
import HanabiGameController from '~/games/hanabi/client/HanabiGameController';
import HanabiOptionsController from '~/games/hanabi/client/HanabiOptionsController';
import HanabiRouter from '~/games/hanabi/client/HanabiRouter';
import HanabiStyles from '~/games/hanabi/client/HanabiStyles';
import { HANABI_TILE_TOUCH_SLOP_PX } from '~/games/hanabi/client/HanabiTouchInteractions';
import Page from '~/pages/Page';
import useAudioUnlock from '~/utils/client/useAudioUnlock';
import useSetTitle from '~/utils/client/useSetTitle';
import {
	MouseTransition,
	MultiBackend,
	MultiBackendOptions,
	TouchTransition,
} from 'react-dnd-multi-backend';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { TouchBackend } from 'react-dnd-touch-backend';

const title = 'Hanabi | Play';

export const HANABI_DND_OPTIONS = {
	backends: [
		{
			id: 'html5',
			backend: HTML5Backend,
			transition: MouseTransition,
		},
		{
			id: 'touch',
			backend: TouchBackend,
			options: {
				ignoreContextMenu: true,
				touchSlop: HANABI_TILE_TOUCH_SLOP_PX,
			},
			transition: TouchTransition,
		},
	],
} satisfies MultiBackendOptions;

const HanabiPage: Page = () => {
	useSetTitle(title);

	useAudioUnlock();

	return (
		<SocketManagerController>
			<GameManagerController>
				<HanabiOptionsController>
					<HanabiGameController>
						<DndProvider backend={MultiBackend} options={HANABI_DND_OPTIONS}>
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
