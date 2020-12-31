import EscapeGameView from 'app/src/games/escape/client/EscapeGameView';

import SocketManagerController from '../../components/SocketManagerController';
import Page from '../../pages/Page';

const title = 'Escape | Play';

const EscapePage: Page = () => {
	return (
		<SocketManagerController>
			<EscapeGameView />
		</SocketManagerController>
	);
};

EscapePage.preload = async function () {
	console.log('GamePage preloaded');
};

EscapePage.title = title;

export default EscapePage;
