import EscapeGameManager from 'app/src/games/escape/client/EscapeGameManager';
import { Fragment, useRef } from 'react';

interface Props {
	connected: boolean;
	gameManager: EscapeGameManager;
}

export default function EscapeGameLobby({ connected, gameManager }: Props): JSX.Element {
	const loadingRef = useRef(false);

	const hostButtonHandleClick = async () => {
		if (loadingRef.current) {
			return;
		}

		loadingRef.current = true;
		await gameManager.host();
		loadingRef.current = false;
	};

	return (
		<Fragment>
			<div className="EscapeGameLobby-DescriptionContainer">
				<p className="EscapeGameLobby-Description">
					Escape is a virtual escape room meant for 4-8 players.
				</p>
			</div>
			<div className="EscapeGameLobby-GameActions">
				<button
					disabled={!connected}
					className="EscapeGameLobby-GameAction"
					onClick={hostButtonHandleClick}
				>
					Host
				</button>
				<button disabled={!connected} className="EscapeGameLobby-GameAction">
					Join
				</button>
			</div>
		</Fragment>
	);
}
