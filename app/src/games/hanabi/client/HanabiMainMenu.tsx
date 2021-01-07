import { useHanabiContext } from 'app/src/games/hanabi/client/HanabiContext';
import HanabiMenuButton from 'app/src/games/hanabi/client/HanabiMenuButton';
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
		<div className="flex flex-col items-center">
			<p className="text-lg font-bold mb-10 text-center px-5 py-3 bg-gray-400 text-black">
				Hanabi is a cooperative puzzle game for 2-5 players.
			</p>
			<div className="flex justify-center">
				<div className="mx-2">
					<HanabiMenuButton label="Host" onClick={hostButtonHandler} />
				</div>
				<div className="mx-2">
					<HanabiMenuButton label="Join" onClick={watchButtonHandler} />
				</div>
			</div>
		</div>
	);
}
