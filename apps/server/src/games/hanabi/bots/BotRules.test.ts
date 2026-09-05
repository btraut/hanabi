import {
	doesHanabiTileMatchClue,
	generateHanabiGameData,
	generateRandomDeck,
	getHanabiFireworkSequence,
	getHanabiRuleSetColors,
	HANABI_RULE_SETS,
} from '@hanabi/shared';
import { describe, expect, it } from 'vitest';
import { getBotRules, isBotRules, renderBotRules } from './BotRules.js';

describe('active bot rules', () => {
	it.each(HANABI_RULE_SETS)('describes only the %s suits and matching rules', (ruleSet) => {
		const rules = getBotRules(generateHanabiGameData({ ruleSet }));
		const instructions = renderBotRules(rules);
		const [deck] = generateRandomDeck(ruleSet, 'rules-counts');
		expect(rules.suits.map(({ color }) => color)).toEqual(getHanabiRuleSetColors(ruleSet));
		for (const suit of rules.suits) {
			expect(suit.playSequence).toEqual(getHanabiFireworkSequence(suit.color));
			for (const { number, count } of suit.copies) {
				expect(count).toBe(
					Object.values(deck).filter((tile) => tile.color === suit.color && tile.number === number)
						.length,
				);
			}
			for (const color of rules.colorClues) {
				expect(suit.matchingColorClues.includes(color)).toBe(
					doesHanabiTileMatchClue({ id: 'visible', color: suit.color, number: 1 }, ruleSet, {
						color,
					}),
				);
			}
		}
		for (const color of ['purple', 'rainbow', 'black'] as const) {
			expect(instructions.toLowerCase().includes(color)).toBe(
				rules.suits.some((suit) => suit.color === color),
			);
		}
		expect(isBotRules(rules)).toBe(true);
	});

	it('explains Black Powder scoring and its descending completion', () => {
		const rules = getBotRules(generateHanabiGameData({ ruleSet: 'black-powder' }));
		expect(rules.maxScore).toBe(25);
		expect(rules.completionTileCount).toBe(30);
		expect(renderBotRules(rules)).toContain(
			'max(0, colored cards played − (5 − Black cards played))',
		);
		expect(renderBotRules(rules)).toContain('completion card is 1');
		expect(rules.suits.find(({ color }) => color === 'black')?.copies).toEqual([
			{ number: 1, count: 1 },
			{ number: 2, count: 2 },
			{ number: 3, count: 2 },
			{ number: 4, count: 2 },
			{ number: 5, count: 3 },
		]);
	});

	it('states exact enabled and disabled game options', () => {
		const enabled = renderBotRules(getBotRules(generateHanabiGameData()));
		const disabled = renderBotRules(
			getBotRules(
				generateHanabiGameData({ criticalGameOver: false, allowDragging: false, showNotes: false }),
			),
		);
		expect(enabled).toContain('discarding or failing to play the last available copy');
		expect(enabled).toContain('even with lives remaining');
		expect(enabled).toContain('Card dragging is enabled');
		expect(enabled).toContain('Visible card notes are enabled');
		expect(disabled).toContain('losing the last unbuilt copy does not itself end the game');
		expect(disabled).toContain('Arrangement must be null');
		expect(disabled).toContain('Visible card notes are disabled');
		expect(disabled).not.toContain('immediately ends the game');
	});

	it('validates saved descriptors without depending on JSON property order', () => {
		const rules = getBotRules(generateHanabiGameData());
		const reordered: unknown = JSON.parse(
			JSON.stringify(rules, (_key, value: unknown) =>
				value && typeof value === 'object' && !Array.isArray(value)
					? Object.fromEntries(Object.entries(value).reverse())
					: value,
			),
		);
		expect(isBotRules(reordered)).toBe(true);
		expect(isBotRules({ ...rules, maxClues: -1 })).toBe(false);
		// A saved descriptor remains readable if later engine defaults change.
		expect(isBotRules({ ...rules, maxClues: 9 })).toBe(true);
		expect(isBotRules({ ...rules, allowDragging: 'yes' })).toBe(false);
		expect(isBotRules(null)).toBe(false);
	});
});
