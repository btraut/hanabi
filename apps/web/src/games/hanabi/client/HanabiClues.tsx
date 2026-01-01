import HanabiClue from '~/games/hanabi/client/HanabiClue';
import { useGameData } from '~/games/hanabi/client/HanabiGameContext';
import { HANABI_MAX_CLUES } from '@hanabi/shared';
import mapXTimes from '~/utils/mapXTimes';
import classNames from 'classnames';

export default function HanabiClues(): JSX.Element {
	const gameData = useGameData();

	const remainingClues = gameData.clues;

	return (
		<div className="grid grid-flow-col gap-0.5">
			{mapXTimes(HANABI_MAX_CLUES, (index) => (
				<div
					key={`clue-${index}`}
					className={classNames({ 'opacity-20': index >= remainingClues })}
				>
					<HanabiClue animateBackground={remainingClues <= 3 && index < remainingClues} />
				</div>
			))}
		</div>
	);
}
