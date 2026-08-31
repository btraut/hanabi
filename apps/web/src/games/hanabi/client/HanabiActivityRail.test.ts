import { countIncomingUnreadChat } from './HanabiActivityRail';
import { isSendableChatMessage } from './HanabiChatInput';
import { HanabiGameAction, HanabiGameActionType } from '@hanabi/shared';
import { readFileSync } from 'node:fs';
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

describe('HanabiChatInput message validation', () => {
	it('rejects blank messages and accepts visible text', () => {
		expect(isSendableChatMessage('')).toBe(false);
		expect(isSendableChatMessage('   \n ')).toBe(false);
		expect(isSendableChatMessage('  hello table  ')).toBe(true);
	});
});

describe('Hanabi history typography', () => {
	it('keeps history quieter than the tab heading and close to chat scale', () => {
		const source = readFileSync(new URL('./HanabiActivityRail.tsx', import.meta.url), 'utf8');

		expect(source).toContain('truncate text-[18px] font-medium leading-[22px]');
		expect(source).toContain('text-[17px] leading-[22px] text-hanabi-text');
		expect(source).toContain('text-[17px] font-medium leading-[22px]');
		expect(source).toContain('pt-1 text-[14px] tabular-nums text-hanabi-text-muted');
	});
});

describe('Hanabi activity hierarchy', () => {
	it('uses history as the complete move stream without a duplicate latest summary', () => {
		const source = readFileSync(new URL('./HanabiActivityRail.tsx', import.meta.url), 'utf8');

		expect(source).not.toContain('>Latest<');
		expect(source).not.toContain("'latest'");
		expect(source).not.toContain('historyIncludesLatest');
		expect(source).not.toContain('latestActionId');
	});
});

describe('Hanabi activity drawer breakpoint', () => {
	it('uses the drawer throughout the single-column layout', () => {
		const source = readFileSync(new URL('./HanabiActivityRail.tsx', import.meta.url), 'utf8');

		expect(source.match(/window\.matchMedia\('\(max-width: 959px\)'\)/g)).toHaveLength(2);
		expect(source).not.toContain("window.matchMedia('(max-width: 639px)')");
	});
});

describe('Hanabi history highlight replay', () => {
	it('makes highlightable history rows persistent toggle buttons', () => {
		const source = readFileSync(new URL('./HanabiActivityRail.tsx', import.meta.url), 'utf8');

		expect(source).toContain('hanabi-history-action');
		expect(source).toContain('aria-pressed={thisActionHighlighted}');
		expect(source).toContain('highlightAction(thisActionHighlighted ? null : action.id)');
		expect(source).toContain("'is-selected': thisActionHighlighted");
	});
});
