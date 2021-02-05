import HanabiGameFinishedAction from 'app/src/games/hanabi/client/HanabiGameFinishedAction';
import HanabiGameStartedAction from 'app/src/games/hanabi/client/HanabiGameStartedAction';
import HanabiShotClockStartedAction from 'app/src/games/hanabi/client/HanabiShotClockStartedAction';
import HanabiShotClockTickedDownAction from 'app/src/games/hanabi/client/HanabiShotClockTickedDownAction';
import HanabiTileAction from 'app/src/games/hanabi/client/HanabiTileAction';
import { HanabiGameAction, HanabiGameActionType } from 'app/src/games/hanabi/HanabiGameData';

interface Props {
	action: HanabiGameAction;
}

export default function HanabiAction({ action }: Props): JSX.Element | null {
	switch (action.type) {
		case HanabiGameActionType.Play:
			return <HanabiTileAction action={action} />;
		case HanabiGameActionType.Discard:
			return <HanabiTileAction action={action} />;
		case HanabiGameActionType.GiveColorClue:
			return <HanabiTileAction action={action} />;
		case HanabiGameActionType.GiveNumberClue:
			return <HanabiTileAction action={action} />;
		case HanabiGameActionType.GameStarted:
			return <HanabiGameStartedAction action={action} />;
		case HanabiGameActionType.GameFinished:
			return <HanabiGameFinishedAction action={action} />;
		case HanabiGameActionType.ShotClockStarted:
			return <HanabiShotClockStartedAction action={action} />;
		case HanabiGameActionType.ShotClockTickedDown:
			return <HanabiShotClockTickedDownAction action={action} />;
	}

	return null;
}
