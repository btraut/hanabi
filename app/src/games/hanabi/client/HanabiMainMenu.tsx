import { useHanabiContext } from 'app/src/games/hanabi/client/HanabiContext';
import { useRef } from 'react';
import { useHistory } from 'react-router';

export default function HanabiMainMenu(): JSX.Element {
	const hanabiContext = useHanabiContext();
	const history = useHistory();

	const loadingRef = useRef(false);

	const hostButtonHandler = async () => {
		if (loadingRef.current) {
			return;
		}

		loadingRef.current = true;
		const { code } = await hanabiContext.create();
		loadingRef.current = false;

		history.push(`/hanabi/${code}`);
	};

	const watchButtonHandler = () => {
		history.push('/hanabi/join');
	};

	return (
		<>
			<p className="Hanabi-Description">Hanabi is a virtual hanabi room meant for 4-8 players.</p>
			<div className="Hanabi-GameActions">
				<button className="Hanabi-GameAction" onClick={hostButtonHandler}>
					Host
				</button>
				<button className="Hanabi-GameAction" onClick={watchButtonHandler}>
					Join
				</button>
			</div>
		</>
	);
}
