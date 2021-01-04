import SocketManagerController from 'app/src/components/SocketController';
import GameManagerController from 'app/src/games/client/GameManagerController';
import EscapeController from 'app/src/games/escape/client/EscapeController';
import EscapeGameView from 'app/src/games/escape/client/EscapeRouter';
import Page from 'app/src/pages/Page';
import useSetTitle from 'app/src/utils/client/useSetTitle';
import { useEffect } from 'react';

const title = 'Escape | Play';

const EscapePage: Page = () => {
	useSetTitle(title);

	useEffect(() => {
		document.body.classList.add('Escape-DocumentBody');
		return () => document.body.classList.remove('Escape-DocumentBody');
	});

	return (
		<SocketManagerController>
			<GameManagerController>
				<EscapeController>
					<EscapeGameView />
				</EscapeController>
			</GameManagerController>
		</SocketManagerController>
	);
};

EscapePage.title = title;

export default EscapePage;
