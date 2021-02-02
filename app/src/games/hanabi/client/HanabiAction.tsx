import HanabiGameStartedAction from 'app/src/games/hanabi/client/HanabiGameStartedAction';
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
	}

	return null;
}
