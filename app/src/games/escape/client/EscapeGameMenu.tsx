import EscapeGameManager from 'app/src/games/escape/client/EscapeGameManager';
import { useRef } from 'react';
import { useHistory } from 'react-router';

interface Props {
	gameManager: EscapeGameManager;
}

export default function EscapeGameLobby({ gameManager }: Props): JSX.Element {
	const history = useHistory();

	const loadingRef = useRef(false);

	const hostButtonHandler = async () => {
		if (loadingRef.current) {
			return;
		}

		loadingRef.current = true;
		await gameManager.create();
		await gameManager.watch(gameManager.code!);
		loadingRef.current = false;

		history.push(`/escape/${gameManager.code}`);
	};

	const watchButtonHandler = () => {
		history.push('/escape/join');
	};

	return (
		<>
			<div className="EscapeGameLobby-DescriptionContainer">
				<p className="EscapeGameLobby-Description">
					Escape is a virtual escape room meant for 4-8 players.
				</p>
			</div>
			<div className="EscapeGameLobby-GameActions">
				<button className="EscapeGameLobby-GameAction" onClick={hostButtonHandler}>
					Host
				</button>
				<button className="EscapeGameLobby-GameAction" onClick={watchButtonHandler}>
					Join
				</button>
			</div>
		</>
	);
}
