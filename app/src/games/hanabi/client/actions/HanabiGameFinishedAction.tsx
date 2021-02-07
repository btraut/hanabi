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
			return (
				<div className="text-md p-3">
					<span className="font-bold">Congratulations! You win!</span>
				</div>
			);
		case HanabiFinishedReason.OutOfTurns:
			return (
				<div className="text-md p-3">
					<span className="font-bold">Game over!</span> You ran out of turns.
				</div>
			);
		case HanabiFinishedReason.OutOfLives:
			return (
				<div className="text-md p-3">
					<span className="font-bold">Game over!</span> You ran out of lives.
				</div>
			);
		case HanabiFinishedReason.DiscardedFatalTile:
			return (
				<div className="text-md p-3">
					<span className="font-bold">Game over!</span> You discarded a necessary tile.
				</div>
			);
	}
}
