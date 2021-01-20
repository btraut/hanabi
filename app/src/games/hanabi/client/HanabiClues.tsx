import HanabiClue from 'app/src/games/hanabi/client/HanabiClue';
import { useHanabiGame } from 'app/src/games/hanabi/client/HanabiContext';
import { HANABI_MAX_CLUES } from 'app/src/games/hanabi/HanabiGameData';

export default function HanabiClues(): JSX.Element {
	const game = useHanabiGame();

	const remainingClues = game.gameData.clues;

	return (
		<div className="grid grid-flow-col justify-start gap-x-1">
			{new Array(HANABI_MAX_CLUES).fill('').map((_, index) => (
				<HanabiClue key={`clue-${index}`} placeholder={index >= remainingClues} />
			))}
		</div>
	);
}
