import { countIncomingUnreadChat } from './HanabiActivityRail';
import { HanabiGameAction, HanabiGameActionType } from '@hanabi/shared';
import { describe, expect, it } from 'vitest';

const actions: HanabiGameAction[] = [
	{
		id: 'old-chat',
		message: 'Historical',
		playerId: 'bob',
		type: HanabiGameActionType.Chat,
	},
	{
		id: 'own-chat',
		message: 'Mine',
		playerId: 'alice',
		type: HanabiGameActionType.Chat,
	},
	{
		id: 'remote-chat',
		message: 'Incoming',
		playerId: 'bob',
		type: HanabiGameActionType.Chat,
	},
	{
		id: 'game-start',
		startingPlayerId: 'alice',
		type: HanabiGameActionType.GameStarted,
	},
];

describe('HanabiActivityRail unread chat', () => {
	it('counts only new remote chat while the chat tab is closed', () => {
		expect(countIncomingUnreadChat(actions, 1, 'alice', false)).toBe(1);
	});

	it('does not count historical, own, open-tab, or truncated actions', () => {
		expect(countIncomingUnreadChat(actions, actions.length, 'alice', false)).toBe(0);
		expect(countIncomingUnreadChat(actions, 0, 'alice', true)).toBe(0);
		expect(countIncomingUnreadChat(actions.slice(0, 2), 1, 'alice', false)).toBe(0);
		expect(countIncomingUnreadChat(actions.slice(0, 2), 10, 'alice', false)).toBe(0);
	});
});
