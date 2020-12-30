import GameView from 'app/src/games/escape/client/EscapeGameView';
import useSetTitle from 'app/src/utils/client/useSetTitle';

import SocketManagerController from '../components/SocketManagerController';
import Page from './Page';

const title = 'Escape | Play';

const EscapePage: Page = () => {
	useSetTitle(title);

	return (
		<SocketManagerController>
			<div className="EscapePage">
				<div className="EscapePage-Container">
					<GameView />
				</div>
			</div>
		</SocketManagerController>
	);
};

EscapePage.preload = async function () {
	console.log('GamePage preloaded');
};

EscapePage.title = title;

export default EscapePage;
