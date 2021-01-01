import EscapeGameManagerController from 'app/src/games/escape/client/EscapeGameManagerController';
import EscapeGameView from 'app/src/games/escape/client/EscapeGameView';
import useSetTitle from 'app/src/utils/client/useSetTitle';

import SocketManagerController from '../../components/SocketManagerController';
import Page from '../../pages/Page';

const title = 'Escape | Play';

const EscapePage: Page = () => {
	useSetTitle(title);

	return (
		<SocketManagerController>
			<EscapeGameManagerController>
				<EscapeGameView />
			</EscapeGameManagerController>
		</SocketManagerController>
	);
};

EscapePage.title = title;

export default EscapePage;
