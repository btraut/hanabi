import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { HanabiHighlightContextProvider } from './HanabiHighlightContext';
import { getHanabiDesktopFixtures } from './dev/HanabiDesktopFixtures';
import HanabiActivityRail, { countIncomingUnreadChat } from './HanabiActivityRail';
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
	it('counts only new remote chat while the activity drawer is closed', () => {
		expect(countIncomingUnreadChat(actions, 'old-chat', 'alice', false)).toBe(1);
	});

	it('counts new chat even when the server truncates the oldest actions', () => {
		const capped = [actions[1], actions[2], actions[3], { ...actions[2], id: 'new-chat' }];
		expect(countIncomingUnreadChat(capped, 'game-start', 'alice', false)).toBe(1);
	});

	it('does not count historical, own, open-tab, or truncated actions', () => {
		expect(countIncomingUnreadChat(actions, 'game-start', 'alice', false)).toBe(0);
		expect(countIncomingUnreadChat(actions, null, 'alice', true)).toBe(0);
		expect(countIncomingUnreadChat(actions.slice(0, 2), 'old-chat', 'alice', false)).toBe(0);
		expect(countIncomingUnreadChat(actions.slice(0, 2), 'own-chat', 'alice', false)).toBe(0);
	});
});

describe('HanabiChatInput message validation', () => {
	it('rejects blank messages and accepts visible text', () => {
		expect(isSendableChatMessage('')).toBe(false);
		expect(isSendableChatMessage('   \n ')).toBe(false);
		expect(isSendableChatMessage('  hello table  ')).toBe(true);
	});
});

describe('Hanabi history clue descriptions', () => {
	function renderActions(actionsToRender: HanabiGameAction[]): string {
		const fixture = getHanabiDesktopFixtures().standard;
		return renderToStaticMarkup(
			createElement(
				HanabiHighlightContextProvider,
				{
					value: {
						highlightAction: () => {},
						highlightedAction: null,
						highlightedLabel: null,
						highlightedRecipientId: null,
						highlightedTiles: new Set<string>(),
						highlightedTone: null,
					},
				},
				createElement(HanabiActivityRail, {
					composer: 'Chat input',
					gameData: { ...fixture.gameData, actions: actionsToRender },
					userId: fixture.userId,
				}),
			),
		);
	}

	const redClue: HanabiGameAction = {
		id: 'red-clue',
		playerId: 'player-2',
		recipientId: 'player-1',
		color: 'red',
		tiles: [{ id: 'red-five', color: 'red', number: 5 }],
		type: HanabiGameActionType.GiveColorClue,
	};

	it('shows the color clue without an affected-tile count', () => {
		const text = renderActions([redClue])
			.replace(/<span aria-hidden="true"[^>]*>[^<]*<\/span>/g, '')
			.replace(/<[^>]*>/g, '');
		expect(text).toContain('Alice clued You');
		expect(text).toContain('Red clue');
		expect(text).not.toContain('tile');
		expect(text).not.toContain('Touches');
		expect(text).not.toContain('Red: 1');
		expect(text).not.toContain('Red 5');
	});

	it('interleaves moves and messages in their original order with distinct presentation', () => {
		const markup = renderActions([
			{
				id: 'before',
				playerId: 'player-1',
				message: 'Before the clue',
				type: HanabiGameActionType.Chat,
			},
			redClue,
			{
				id: 'after',
				playerId: 'player-2',
				message: 'After the clue',
				type: HanabiGameActionType.Chat,
			},
		]);
		const text = markup.replace(/<[^>]*>/g, '');
		expect(text.indexOf('Before the clue')).toBeLessThan(text.indexOf('Red clue'));
		expect(text.indexOf('Red clue')).toBeLessThan(text.indexOf('After the clue'));
		expect(markup.match(/class="hanabi-feed-chat"/g)).toHaveLength(2);
		expect(markup.match(/class="hanabi-feed-event"/g)).toHaveLength(1);
		expect(markup).not.toContain('role="tab"');
	});

	it('shows only the clue number without a competing count or suit color', () => {
		const markup = renderActions([
			{
				id: 'number-clue',
				playerId: 'player-2',
				recipientId: 'player-1',
				number: 5,
				tiles: [
					{ id: 'red-five', color: 'red', number: 5 },
					{ id: 'blue-five', color: 'blue', number: 5 },
				],
				type: HanabiGameActionType.GiveNumberClue,
			},
		]);
		const text = markup.replace(/<[^>]*>/g, '');
		expect(text).toContain('5 clue');
		expect(text).not.toContain('tiles');
		expect(text).not.toContain('Touches');
		expect(markup).not.toContain('#d5ad61');
		expect(markup).not.toContain('rounded-full border-2');
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
