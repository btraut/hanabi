import { HanabiGameActionShotClockStarted } from 'app/src/games/hanabi/HanabiGameData';

interface Props {
	action: HanabiGameActionShotClockStarted;
}

export default function HanabiShotClockStartedAction({ action }: Props): JSX.Element {
	return (
		<div className="text-md xl:text-lg p-4">
			The game will end soon! You have{' '}
			<span className="font-bold">
				{action.remainingTurns} {action.remainingTurns === 1 ? 'turn' : 'turns'} left
			</span>
			.
		</div>
	);
}
