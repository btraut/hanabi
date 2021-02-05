import {
	HanabiFinishedReason,
	HanabiGameActionGameFinished,
} from 'app/src/games/hanabi/HanabiGameData';

interface Props {
	action: HanabiGameActionGameFinished;
}

export default function HanabiGameFinishedAction({ action }: Props): JSX.Element {
	switch (action.finishedReason) {
		case HanabiFinishedReason.Won:
			return <div className="text-md xl:text-lg p-4">Congratulations! You win!</div>;
		case HanabiFinishedReason.OutOfTurns:
			return <div className="text-md xl:text-lg p-4">The game is over. You ran out of turns.</div>;
		case HanabiFinishedReason.OutOfLives:
			return <div className="text-md xl:text-lg p-4">The game is over. You ran out of lives.</div>;
		case HanabiFinishedReason.DiscardedFatalTile:
			return (
				<div className="text-md xl:text-lg p-4">
					The game is over. You discarded a tile necessary to completing the game.
				</div>
			);
	}
}
