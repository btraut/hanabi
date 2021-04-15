import HanabiMenuButton from 'app/src/games/hanabi/client/design-system/HanabiMenuButton';
import { useHanabiContext } from 'app/src/games/hanabi/client/HanabiContext';
import HanabiTileView from 'app/src/games/hanabi/client/HanabiTileView';
import { HanabiTileColor, HanabiTileNumber } from 'app/src/games/hanabi/HanabiGameData';
import useForceRefresh from 'app/src/utils/client/useForceRefresh';
import { useEffect, useRef } from 'react';
import { useHistory } from 'react-router';

const randomColorChoices: HanabiTileColor[] = ['red', 'blue', 'green', 'yellow', 'white'];

function generateRandomTile() {
	return {
		number: (Math.floor(Math.random() * 5) + 1) as HanabiTileNumber,
		color: randomColorChoices[Math.floor(Math.random() * randomColorChoices.length)],
	};
}

export default function HanabiMainMenu(): JSX.Element {
	const hanabiContext = useHanabiContext();
	const history = useHistory();

	const loadingRef = useRef(false);

	const forceRefresh = useForceRefresh();

	const hostButtonHandler = async () => {
		if (loadingRef.current) {
			return;
		}

		loadingRef.current = true;
		const { code } = await hanabiContext.create();
		loadingRef.current = false;

		history.push(`/${code}`);
	};

	const watchButtonHandler = () => {
		history.push('/join');
	};

	useEffect(() => {
		const id = setInterval(forceRefresh, 1500);

		return () => {
			clearInterval(id);
		};
	});

	return (
		<div className="w-screen min-h-screen p-20 grid grid-flow-row gap-10 content-center justify-center">
			<div className="grid grid-flow-row gap-4">
				<h1 className="mb-10 text-8xl italic text-white text-center text-shadow">Hanabi</h1>
				<div className="grid grid-flow-col gap-2 justify-center content-center">
					<HanabiTileView {...generateRandomTile()} border={false} />
					<HanabiTileView {...generateRandomTile()} border={false} />
					<HanabiTileView {...generateRandomTile()} border={false} />
					<HanabiTileView {...generateRandomTile()} border={false} />
					<HanabiTileView {...generateRandomTile()} border={false} />
					<HanabiTileView {...generateRandomTile()} border={false} />
					<HanabiTileView {...generateRandomTile()} border={false} />
					<HanabiTileView {...generateRandomTile()} border={false} />
				</div>
				<div className="text-lg font-bold text-center px-5 py-3 rounded-xl bg-white text-black">
					Hanabi is a cooperative puzzle game for 2-5 players.
				</div>
			</div>
			<div className="grid grid-flow-col gap-4 justify-center">
				<HanabiMenuButton label="Host" onClick={hostButtonHandler} />
				<HanabiMenuButton label="Join" onClick={watchButtonHandler} />
			</div>
		</div>
	);
}
