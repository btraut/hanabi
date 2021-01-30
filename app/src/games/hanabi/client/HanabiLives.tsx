import { useHanabiGame } from 'app/src/games/hanabi/client/HanabiContext';
import HanabiLife from 'app/src/games/hanabi/client/HanabiLife';
import { HANABI_MAX_LIVES } from 'app/src/games/hanabi/HanabiGameData';

const LIFE_OFFSET = 12;
const LIFE_SIZE = 48;

interface Props {
	stack?: boolean;
}

export default function HanabiLives({ stack = true }: Props): JSX.Element {
	const game = useHanabiGame();

	const remainingLives = game.gameData.lives;
	const numLives = stack ? HANABI_MAX_LIVES : 1;

	return (
		<div
			className="relative"
			style={{ width: (numLives - 1) * LIFE_OFFSET + LIFE_SIZE, height: LIFE_SIZE }}
		>
			{new Array(numLives).fill('').map((_, index) => (
				<div
					key={`clue-${index}`}
					className="absolute"
					style={{ left: index * LIFE_OFFSET, zIndex: HANABI_MAX_LIVES - index, top: 0 }}
				>
					{stack && <HanabiLife placeholder={index >= remainingLives} size={LIFE_SIZE} />}
				</div>
			))}

			{!stack && (
				<div className="relative">
					<HanabiLife size={LIFE_SIZE} hideIcon />
					<div className="absolute inset-0 flex justify-center items-center text-white text-xl">
						{remainingLives}
					</div>
				</div>
			)}
		</div>
	);
}
