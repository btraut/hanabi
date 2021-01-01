import { useEscapeGameManager } from 'app/src/games/escape/client/EscapeGameManagerContext';
import { useRef } from 'react';
import { useHistory } from 'react-router';

export default function EscapeGameLobby(): JSX.Element {
	const gameManager = useEscapeGameManager();
	const history = useHistory();

	const loadingRef = useRef(false);

	const hostButtonHandler = async () => {
		if (loadingRef.current) {
			return;
		}

		loadingRef.current = true;
		await gameManager.create();
		await gameManager.watch(gameManager.code!);
		await gameManager.refreshGameData();
		loadingRef.current = false;

		history.push(`/escape/${gameManager.code}`);
	};

	const watchButtonHandler = () => {
		history.push('/escape/join');
	};

	return (
		<>
			<div className="EscapeGame-DescriptionContainer">
				<p className="EscapeGame-Description">
					Escape is a virtual escape room meant for 4-8 players.
				</p>
			</div>
			<div className="EscapeGame-GameActions">
				<button className="EscapeGame-GameAction" onClick={hostButtonHandler}>
					Host
				</button>
				<button className="EscapeGame-GameAction" onClick={watchButtonHandler}>
					Join
				</button>
			</div>
		</>
	);
}
