import { useHanabiGame } from 'app/src/games/hanabi/client/HanabiContext';
import HanabiLife from 'app/src/games/hanabi/client/HanabiLife';
import { HANABI_MAX_LIVES } from 'app/src/games/hanabi/HanabiGameData';
import classnames from 'classnames';

export default function HanabiLives(): JSX.Element {
	const game = useHanabiGame();

	const remainingLives = game.gameData.lives;

	return (
		<div className="grid grid-flow-col gap-0.5">
			{new Array(HANABI_MAX_LIVES).fill('').map((_, index) => (
				<div
					key={`clue-${index}`}
					className={classnames({ 'opacity-20': index >= remainingLives })}
				>
					<HanabiLife />
				</div>
			))}
		</div>
	);
}
