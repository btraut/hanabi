import { describe, expect, it } from 'vitest';
import {
	botClueChanges,
	botClueEvidence,
	botPossibleIdentities,
	botPublicRemainingCopies,
	literalBotIdentities,
	type BotKnowledgeClue,
} from './BotKnowledge.js';

const one: BotKnowledgeClue = {
	eventId: 'clue-1',
	clue: { type: 'number', value: 1 },
	hand: [{ tileId: 'a' }, { tileId: 'b' }],
	touchedTileIds: ['a'],
	untouchedTileIds: ['b'],
};

describe('literal bot knowledge', () => {
	it('tracks source-linked positive and negative evidence by card ID, leaving replacements fresh', () => {
		expect(botClueEvidence('a', [one])).toEqual({
			positive: [{ eventId: 'clue-1', clue: { type: 'number', value: 1 } }],
			negative: [],
		});
		expect(literalBotIdentities('5-color', botClueEvidence('a', [one]))).toHaveLength(5);
		expect(
			literalBotIdentities('5-color', botClueEvidence('b', [one])).every(
				({ number }) => number !== 1,
			),
		).toBe(true);
		expect(botClueEvidence('new-draw', [one])).toEqual({ positive: [], negative: [] });
		expect(literalBotIdentities('5-color', botClueEvidence('new-draw', [one]))).toHaveLength(25);
	});

	it('intersects Rainbow matching predicates and never makes Black match a color clue', () => {
		const red: BotKnowledgeClue = { ...one, clue: { type: 'color', value: 'red' } };
		const blue: BotKnowledgeClue = {
			...red,
			eventId: 'clue-2',
			clue: { type: 'color', value: 'blue' },
		};
		expect(
			literalBotIdentities('rainbow-black-powder', botClueEvidence('a', [red, blue])).map(
				({ color }) => color,
			),
		).toEqual(Array(5).fill('rainbow'));
		const notBlue: BotKnowledgeClue = { ...blue, touchedTileIds: ['b'], untouchedTileIds: ['a'] };
		expect(
			literalBotIdentities('rainbow-black-powder', botClueEvidence('a', [red, notBlue])).map(
				({ color }) => color,
			),
		).toEqual(Array(5).fill('red'));
		expect(
			literalBotIdentities('black-powder', botClueEvidence('b', [red])).some(
				({ color }) => color === 'black',
			),
		).toBe(true);
		expect(literalBotIdentities('6-color', botClueEvidence('new', []))).toContainEqual({
			color: 'purple',
			number: 5,
		});
	});

	it('labels repeated facts and logical novelty without interpreting single-card clues as playable', () => {
		const first = botClueChanges('5-color', one, []);
		expect(first).toMatchObject([
			{ tileId: 'a', firstEvidence: true, firstPositiveClue: true, newConstraint: true },
			{ tileId: 'b', firstEvidence: true, firstPositiveClue: false, newConstraint: true },
		]);
		const repeat = botClueChanges('5-color', { ...one, eventId: 'clue-2' }, [one]);
		expect(
			repeat.every(
				({ newConstraint, firstEvidence, excludedIdentities }) =>
					!newConstraint && !firstEvidence && excludedIdentities.length === 0,
			),
		).toBe(true);
		const two = { ...one, clue: { type: 'number' as const, value: 2 as const } };
		expect(literalBotIdentities('5-color', botClueEvidence('a', [two]))).toEqual([
			{ color: 'red', number: 2 },
			{ color: 'blue', number: 2 },
			{ color: 'green', number: 2 },
			{ color: 'yellow', number: 2 },
			{ color: 'white', number: 2 },
		]);
	});

	it('separates public exhaustion from observer-only elimination by other visible hands', () => {
		const copies = botPublicRemainingCopies(
			[
				{
					color: 'red',
					copies: [
						{ number: 1, count: 3 },
						{ number: 5, count: 1 },
					],
				},
				{ color: 'blue', copies: [{ number: 1, count: 3 }] },
			],
			[{ color: 'red', number: 5 }],
			[{ color: 'red', number: 1 }],
		);
		expect(copies).toContainEqual({
			color: 'red',
			number: 1,
			totalCopies: 3,
			playedCopies: 0,
			discardedCopies: 1,
			remainingCopies: 2,
		});
		const evidence = botClueEvidence('a', [one]);
		expect(botPossibleIdentities('5-color', evidence, copies)).toEqual([
			{ color: 'red', number: 1 },
			{ color: 'blue', number: 1 },
		]);
		expect(
			botPossibleIdentities('5-color', evidence, copies, [
				{ color: 'red', number: 1 },
				{ color: 'red', number: 1 },
			]),
		).toEqual([{ color: 'blue', number: 1 }]);
		expect(
			botPossibleIdentities('5-color', { positive: [], negative: [] }, copies),
		).not.toContainEqual({ color: 'red', number: 5 });
	});
});
