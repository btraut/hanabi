import { HanabiGameActionType, type HanabiGameActionChat } from '@hanabi/shared';

export const MAX_BOT_EXPLANATION_LENGTH = 1000;
export const BOT_DEBUG_CHAT_PREFIX = 'Debug: ';
export const MAX_BOT_DEBUG_CHAT_LENGTH = BOT_DEBUG_CHAT_PREFIX.length + MAX_BOT_EXPLANATION_LENGTH;

export function createBotDecisionChat(
	playerId: string,
	decisionId: string,
	explanation: string,
): HanabiGameActionChat {
	return {
		id: decisionId,
		type: HanabiGameActionType.Chat,
		playerId,
		message: `${BOT_DEBUG_CHAT_PREFIX}${explanation}`,
	};
}
