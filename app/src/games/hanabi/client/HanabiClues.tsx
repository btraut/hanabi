import HanabiClue from 'app/src/games/hanabi/client/HanabiClue';
import { useHanabiGame } from 'app/src/games/hanabi/client/HanabiContext';
import { HANABI_MAX_CLUES } from 'app/src/games/hanabi/HanabiGameData';

const CLUE_OFFSET = 12;
const CLUE_SIZE = 48;

interface Props {
	stack?: boolean;
}

export default function HanabiClues({ stack = true }: Props): JSX.Element {
	const game = useHanabiGame();

	const remainingClues = game.gameData.clues;
	const numClues = stack ? HANABI_MAX_CLUES : 1;

	return (
		<div
			className="relative"
			style={{ width: (numClues - 1) * CLUE_OFFSET + CLUE_SIZE, height: CLUE_SIZE }}
		>
			{new Array(numClues).fill('').map((_, index) => (
				<div
					key={`clue-${index}`}
					className="absolute"
					style={{ left: index * CLUE_OFFSET, zIndex: HANABI_MAX_CLUES - index, top: 0 }}
				>
					{stack && <HanabiClue placeholder={index >= remainingClues} size={CLUE_SIZE} />}
				</div>
			))}

			{!stack && (
				<div className="relative">
					<HanabiClue size={CLUE_SIZE} hideIcon />
					<div className="absolute inset-0 flex justify-center items-center text-white text-xl">
						{remainingClues}
					</div>
				</div>
			)}
		</div>
	);
}
