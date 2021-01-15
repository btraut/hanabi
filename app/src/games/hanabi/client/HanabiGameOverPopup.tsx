import { useSocket } from 'app/src/components/SocketContext';
import { useHanabiGame } from 'app/src/games/hanabi/client/HanabiContext';
import HanabiMenuButton from 'app/src/games/hanabi/client/HanabiMenuButton';
import HanabiPopup from 'app/src/games/hanabi/client/HanabiPopup';
import { HanabiFinishedReason } from 'app/src/games/hanabi/HanabiGameData';
import { useCallback } from 'react';

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

export default function HanabiGameOverPopup(): JSX.Element | null {
	const { userId } = useSocket();
	const game = useHanabiGame();

	if (!game || !userId) {
		throw new Error('Must connect/join. This should never happen.');
	}

	const handleNewGameClick = useCallback(async () => game.reset(), [game]);

	const { finishedReason } = game.gameData;

	if (finishedReason === null) {
		return null;
	}

	return (
		<HanabiPopup background={finishedReason === HanabiFinishedReason.Won ? 'green' : 'red'}>
			<h1 className="italic text-4xl text-white font-normal text-center mb-2">
				{GAME_OVER_TITLES[finishedReason]}
			</h1>
			<p className="italic text-2xl text-white font-normal text-center mb-8">
				{GAME_OVER_MESSAGES[finishedReason]}
			</p>
			<div className="flex justify-center">
				<HanabiMenuButton label="New Game" onClick={handleNewGameClick} />
			</div>
		</HanabiPopup>
	);
}
