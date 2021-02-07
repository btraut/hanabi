import { HanabiGameActionShotClockTickedDown } from 'app/src/games/hanabi/HanabiGameData';

interface Props {
	action: HanabiGameActionShotClockTickedDown;
}

export default function HanabiShotClockTickedDownAction({ action }: Props): JSX.Element {
	return (
		<div className="text-md p-3">
			Tick tock! You have{' '}
			<span className="font-bold">
				{action.remainingTurns} {action.remainingTurns === 1 ? 'turn' : 'turns'} left
			</span>
			.
		</div>
	);
}
