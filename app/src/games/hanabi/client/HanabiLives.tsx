import { useGameData } from 'app/src/games/hanabi/client/HanabiContext';
import HanabiLife from 'app/src/games/hanabi/client/HanabiLife';
import { HANABI_MAX_LIVES } from 'app/src/games/hanabi/HanabiGameData';
import mapXTimes from 'app/src/utils/mapXTimes';
import classNames from 'classnames';

export default function HanabiLives(): JSX.Element {
	const gameData = useGameData();

	const remainingLives = gameData.lives;

	return (
		<div className="grid grid-flow-col gap-0.5 justify-start">
			{mapXTimes(HANABI_MAX_LIVES, (index) => (
				<div
					key={`clue-${index}`}
					className={classNames({ 'opacity-20': index >= remainingLives })}
				>
					<HanabiLife />
				</div>
			))}
		</div>
	);
}
