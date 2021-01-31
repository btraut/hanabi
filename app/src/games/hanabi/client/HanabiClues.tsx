import HanabiClue from 'app/src/games/hanabi/client/HanabiClue';
import { useHanabiGame } from 'app/src/games/hanabi/client/HanabiContext';
import { HANABI_MAX_CLUES } from 'app/src/games/hanabi/HanabiGameData';
import classnames from 'classnames';

export default function HanabiClues(): JSX.Element {
	const game = useHanabiGame();

	const remainingClues = game.gameData.clues;

	return (
		<div className="grid grid-flow-col gap-0.5">
			{new Array(HANABI_MAX_CLUES).fill('').map((_, index) => (
				<div
					key={`clue-${index}`}
					className={classnames({ 'opacity-20': index >= remainingClues })}
				>
					<HanabiClue />
				</div>
			))}
		</div>
	);
}
