import GameManagerController from 'app/src/games/client/GameManagerController';
import EscapeGameController from 'app/src/games/escape/client/EscapeGameController';
import EscapeGameView from 'app/src/games/escape/client/EscapeGameView';
import useSetTitle from 'app/src/utils/client/useSetTitle';
import { useEffect } from 'react';

import SocketManagerController from '../../components/SocketManagerController';
import Page from '../../pages/Page';

const title = 'Escape | Play';

const EscapePage: Page = () => {
	useSetTitle(title);

	useEffect(() => {
		document.body.classList.add('EscapeGame-DocumentBody');
		return () => document.body.classList.remove('EscapeGame-DocumentBody');
	});

	return (
		<SocketManagerController>
			<GameManagerController>
				<EscapeGameController>
					<EscapeGameView />
				</EscapeGameController>
			</GameManagerController>
		</SocketManagerController>
	);
};

EscapePage.title = title;

export default EscapePage;
