import { getHanabiActionHighlight, getLatestHanabiTileAction } from './useActionHighlighter';
import { HanabiGameAction, HanabiGameActionType } from '@hanabi/shared';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const tile = (id: string) => ({ id, color: 'red' as const, number: 3 as const });

describe('Hanabi action highlight', () => {
	it('uses the clue color and every selected tile for a color clue', () => {
		const action = {
			id: 'color-clue',
			playerId: 'giver',
			recipientId: 'recipient',
			type: HanabiGameActionType.GiveColorClue,
			color: 'red',
			tiles: [tile('a'), tile('b')],
		} as HanabiGameAction;

		expect(getHanabiActionHighlight(action)).toEqual({
			label: 'Red',
			recipientId: 'recipient',
			tileIds: ['a', 'b'],
			tone: 'red',
		});
	});

	it('distinguishes number clues from generic tile actions', () => {
		const numberClue = {
			id: 'number-clue',
			playerId: 'giver',
			recipientId: 'recipient',
			type: HanabiGameActionType.GiveNumberClue,
			number: 3,
			tiles: [tile('a')],
		} as HanabiGameAction;
		const play = {
			id: 'play',
			playerId: 'giver',
			type: HanabiGameActionType.Play,
			tile: tile('a'),
			remainingLives: 3,
			valid: true,
		} as HanabiGameAction;

		expect(getHanabiActionHighlight(numberClue)?.tone).toBe('number');
		expect(getHanabiActionHighlight(play)?.tone).toBe('action');
	});

	it('keeps the latest tile action selected through later chat and page reloads', () => {
		const clue = {
			id: 'clue',
			playerId: 'giver',
			recipientId: 'recipient',
			type: HanabiGameActionType.GiveNumberClue,
			number: 3,
			tiles: [tile('a')],
		} as HanabiGameAction;
		const chat = {
			id: 'chat',
			message: 'still thinking',
			playerId: 'recipient',
			type: HanabiGameActionType.Chat,
		} as HanabiGameAction;

		expect(getLatestHanabiTileAction([clue, chat])).toBe(clue);
	});

	it('replaces an old clue with the next tile action', () => {
		const clue = {
			id: 'clue',
			playerId: 'giver',
			recipientId: 'recipient',
			type: HanabiGameActionType.GiveNumberClue,
			number: 3,
			tiles: [tile('a')],
		} as HanabiGameAction;
		const play = {
			id: 'play',
			playerId: 'recipient',
			type: HanabiGameActionType.Play,
			tile: tile('b'),
			remainingLives: 3,
			valid: true,
		} as HanabiGameAction;

		expect(getLatestHanabiTileAction([clue, play])).toBe(play);
	});

	it('does not clear the live mark on a timer', () => {
		const source = readFileSync(new URL('./useActionHighlighter.tsx', import.meta.url), 'utf8');

		expect(source).not.toContain('setTimeout');
		expect(source).not.toContain('HIGHLIGHT_DURATION');
	});
});
