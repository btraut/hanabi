import {
	HANABI_CLUE_COLORS,
	HanabiGameAction,
	HanabiGameActionGiveClue,
	HanabiGameActionType,
} from '@hanabi/shared';
import { describe, expect, it } from 'vitest';
import { getHanabiRecentTileClue } from './HanabiRecentClue';

const tile = { id: 'rainbow-card', color: 'rainbow', number: 3 } as const;
const clue: HanabiGameActionGiveClue = {
	id: 'red-clue',
	type: HanabiGameActionType.GiveColorClue,
	playerId: 'giver',
	recipientId: 'recipient',
	color: 'red',
	tiles: [tile],
};

describe('temporary card clues', () => {
	it.each(HANABI_CLUE_COLORS)('uses the %s clue value even for a rainbow card', (color) => {
		expect(getHanabiRecentTileClue([{ ...clue, color }], 'recipient', tile.id)).toEqual({
			type: 'color',
			value: color,
		});
	});

	it.each([1, 2, 3, 4, 5] as const)('uses number %i from the clue action', (number) => {
		const numberClue: HanabiGameActionGiveClue = {
			...clue,
			type: HanabiGameActionType.GiveNumberClue,
			color: undefined,
			number,
		};
		expect(getHanabiRecentTileClue([numberClue], 'recipient', tile.id)).toEqual({
			type: 'number',
			value: number,
		});
	});

	it('keeps the clue across chat messages', () => {
		const chat: HanabiGameAction = {
			id: 'chat',
			type: HanabiGameActionType.Chat,
			playerId: 'recipient',
			message: 'Thinking',
		};
		expect(getHanabiRecentTileClue([clue, chat], 'recipient', tile.id)).toEqual({
			type: 'color',
			value: 'red',
		});
	});

	it.each<HanabiGameAction>([
		{
			id: 'play',
			type: HanabiGameActionType.Play,
			playerId: 'recipient',
			tile,
			valid: true,
			remainingLives: 3,
		},
		{ id: 'discard', type: HanabiGameActionType.Discard, playerId: 'recipient', tile },
		{ ...clue, id: 'next-color-clue', recipientId: 'giver' },
		{
			...clue,
			id: 'next-number-clue',
			type: HanabiGameActionType.GiveNumberClue,
			recipientId: 'giver',
			color: undefined,
			number: 3,
		},
	])('expires when the next $type action completes', (action) => {
		expect(getHanabiRecentTileClue([clue, action], 'recipient', tile.id)).toBeUndefined();
	});

	it('replaces a clue to the same card with only the latest clue', () => {
		const nextClue: HanabiGameActionGiveClue = {
			...clue,
			id: 'number-clue',
			type: HanabiGameActionType.GiveNumberClue,
			color: undefined,
			number: 3,
		};
		expect(getHanabiRecentTileClue([clue, nextClue], 'recipient', tile.id)).toEqual({
			type: 'number',
			value: 3,
		});
	});

	it('ignores other recipients, untouched cards, and missing clues', () => {
		expect(getHanabiRecentTileClue([clue], 'giver', tile.id)).toBeUndefined();
		expect(getHanabiRecentTileClue([clue], 'recipient', 'untouched')).toBeUndefined();
		expect(getHanabiRecentTileClue([], 'recipient', tile.id)).toBeUndefined();
		expect(
			getHanabiRecentTileClue([{ ...clue, color: undefined }], 'recipient', tile.id),
		).toBeUndefined();
	});
});
