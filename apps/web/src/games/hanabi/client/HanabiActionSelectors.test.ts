import {
	selectChatTranscript,
	selectGameplayHistory,
	selectLatestGameplayAction,
} from './HanabiActionSelectors';
import { HanabiGameAction, HanabiGameActionType } from '@hanabi/shared';
import { describe, expect, it } from 'vitest';

const gameStarted: HanabiGameAction = {
	id: 'start',
	type: HanabiGameActionType.GameStarted,
	startingPlayerId: 'alice',
};
const clue: HanabiGameAction = {
	id: 'clue',
	type: HanabiGameActionType.GiveNumberClue,
	playerId: 'alice',
	recipientId: 'bob',
	tiles: [],
	number: 2,
};
const firstChat: HanabiGameAction = {
	id: 'chat-1',
	type: HanabiGameActionType.Chat,
	playerId: 'bob',
	message: 'First',
};
const secondChat: HanabiGameAction = {
	id: 'chat-2',
	type: HanabiGameActionType.Chat,
	playerId: 'alice',
	message: 'Second',
};

describe('Hanabi action selectors', () => {
	it('selects the newest gameplay action and separates ordered feeds', () => {
		const actions = [gameStarted, firstChat, clue, secondChat];

		expect(selectLatestGameplayAction(actions)).toBe(clue);
		expect(selectGameplayHistory(actions)).toEqual([clue, gameStarted]);
		expect(selectChatTranscript(actions)).toEqual([firstChat, secondChat]);
	});

	it('returns stable empty results for empty and chat-only histories', () => {
		expect(selectLatestGameplayAction([])).toBeUndefined();
		expect(selectGameplayHistory([])).toEqual([]);
		expect(selectChatTranscript([])).toEqual([]);

		expect(selectLatestGameplayAction([firstChat, secondChat])).toBeUndefined();
		expect(selectGameplayHistory([firstChat, secondChat])).toEqual([]);
		expect(selectChatTranscript([firstChat, secondChat])).toEqual([firstChat, secondChat]);
	});

	it('returns no chat for a game-action-only history', () => {
		expect(selectLatestGameplayAction([gameStarted, clue])).toBe(clue);
		expect(selectGameplayHistory([gameStarted, clue])).toEqual([clue, gameStarted]);
		expect(selectChatTranscript([gameStarted, clue])).toEqual([]);
	});
});
