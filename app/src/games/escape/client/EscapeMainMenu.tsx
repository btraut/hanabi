import { useEscapeContext } from 'app/src/games/escape/client/EscapeContext';
import { useRef } from 'react';
import { useHistory } from 'react-router';

export default function EscapeMainMenu(): JSX.Element {
	const escapeContext = useEscapeContext();
	const history = useHistory();

	const loadingRef = useRef(false);

	const hostButtonHandler = async () => {
		if (loadingRef.current) {
			return;
		}

		loadingRef.current = true;
		const { code } = await escapeContext.create();
		loadingRef.current = false;

		history.push(`/escape/${code}`);
	};

	const watchButtonHandler = () => {
		history.push('/escape/join');
	};

	return (
		<>
			<p className="Escape-Description">Escape is a virtual escape room meant for 4-8 players.</p>
			<div className="Escape-GameActions">
				<button className="Escape-GameAction" onClick={hostButtonHandler}>
					Host
				</button>
				<button className="Escape-GameAction" onClick={watchButtonHandler}>
					Join
				</button>
			</div>
		</>
	);
}
