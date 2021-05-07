import HanabiClue from 'app/src/games/hanabi/client/HanabiClue';
import { useHanabiAnimationManager } from 'app/src/games/hanabi/client/HanabiContext';
import { HANABI_MAX_CLUES } from 'app/src/games/hanabi/HanabiGameData';
import mapXTimes from 'app/src/utils/mapXTimes';
import classNames from 'classnames';

export default function HanabiClues(): JSX.Element {
	const animationManager = useHanabiAnimationManager();
	const { displayGameData: gameData } = animationManager;

	const remainingClues = gameData.clues;

	return (
		<div className="grid grid-flow-col gap-0.5">
			{mapXTimes(HANABI_MAX_CLUES, (index) => (
				<div
					key={`clue-${index}`}
					className={classNames({ 'opacity-20': index >= remainingClues })}
				>
					<HanabiClue
						animateBackground={remainingClues <= 3 && index < remainingClues}
						index={index}
					/>
				</div>
			))}
		</div>
	);
}
