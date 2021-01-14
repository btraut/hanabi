import HanabiPopup from 'app/src/games/hanabi/client/HanabiPopup';
import { HanabiFinishedReason } from 'app/src/games/hanabi/HanabiGameData';

interface Props {
	finishedReason: HanabiFinishedReason;
}

const GAME_OVER_TITLES: { [key in HanabiFinishedReason]: string } = {
	Won: 'Congratulations!',
	DiscardedFatalTile: 'Game over!',
	OutOfTurns: 'Game over!',
	OutOfLives: 'Game over!',
};

const GAME_OVER_MESSAGES: { [key in HanabiFinishedReason]: string } = {
	Won: 'You won!',
	DiscardedFatalTile: 'You no longer have the tiles needed to win.',
	OutOfTurns: 'You ran out of turns.',
	OutOfLives: 'You ran out of lives.',
};

export default function HanabiGameOverPopup({ finishedReason }: Props): JSX.Element | null {
	return (
		<HanabiPopup background={finishedReason === HanabiFinishedReason.Won ? 'green' : 'red'}>
			<h1 className="italic text-4xl text-white font-normal text-center mb-2">
				{GAME_OVER_TITLES[finishedReason]}
			</h1>
			<p className="italic text-2xl text-white font-normal text-center">
				{GAME_OVER_MESSAGES[finishedReason]}
			</p>
		</HanabiPopup>
	);
}
