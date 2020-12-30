import EscapeGameLobby from 'app/src/games/escape/client/EscapeGameLobby';
import { EscapeGameStage } from 'app/src/games/escape/client/EscapeGameManager';
import useEscapeGameManager from 'app/src/games/escape/client/useEscapeGameManager';
import useSocketManager from 'app/src/utils/client/useSocketManager';
import { Fragment } from 'react';

export default function EscapeGameView(): JSX.Element {
	const socketManager = useSocketManager();
	const gameManager = useEscapeGameManager(socketManager);

	return (
		<Fragment>
			<h1 className="EscapeGameView-Title">Escape!</h1>
			{gameManager.stage === EscapeGameStage.Lobby && (
				<EscapeGameLobby connected={socketManager.connected} gameManager={gameManager} />
			)}
		</Fragment>
	);
}
