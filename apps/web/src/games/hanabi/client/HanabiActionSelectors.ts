import {
	HanabiGameAction,
	HanabiGameActionChat,
	HanabiGameActionType,
} from '@hanabi/shared';

export type HanabiGameplayAction = Exclude<HanabiGameAction, HanabiGameActionChat>;

function isChatAction(action: HanabiGameAction): action is HanabiGameActionChat {
	return action.type === HanabiGameActionType.Chat;
}

export function selectLatestGameplayAction(
	actions: readonly HanabiGameAction[],
): HanabiGameplayAction | undefined {
	for (let index = actions.length - 1; index >= 0; index -= 1) {
		const action = actions[index];
		if (!isChatAction(action)) return action;
	}

	return undefined;
}

export function selectGameplayHistory(
	actions: readonly HanabiGameAction[],
): readonly HanabiGameplayAction[] {
	return actions.filter((action): action is HanabiGameplayAction => !isChatAction(action)).reverse();
}

export function selectChatTranscript(
	actions: readonly HanabiGameAction[],
): readonly HanabiGameActionChat[] {
	return actions.filter(isChatAction);
}
