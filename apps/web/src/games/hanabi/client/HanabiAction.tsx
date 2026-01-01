import HanabiChatAction from '~/games/hanabi/client/actions/HanabiChatAction';
import HanabiGameFinishedAction from '~/games/hanabi/client/actions/HanabiGameFinishedAction';
import HanabiGameStartedAction from '~/games/hanabi/client/actions/HanabiGameStartedAction';
import HanabiShotClockStartedAction from '~/games/hanabi/client/actions/HanabiShotClockStartedAction';
import HanabiShotClockTickedDownAction from '~/games/hanabi/client/actions/HanabiShotClockTickedDownAction';
import HanabiTileAction from '~/games/hanabi/client/actions/HanabiTileAction';
import { HanabiGameAction, HanabiGameActionType } from '@hanabi/shared';

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
		case HanabiGameActionType.Chat:
			return <HanabiChatAction action={action} />;
	}

	return null;
}
