import { describe, expect, it } from 'vitest';
import {
	HANABI_MAX_CLUES,
	HANABI_MAX_LIVES,
	type HanabiRuleSet,
	HanabiStage,
	addToTileNotes,
	getHanabiCompletionTileCount,
	getHanabiFireworkSequence,
	getHanabiMaxScore,
	getHanabiRuleSetColors,
	getHanabiScore,
	generateHanabiGameData,
	generateRandomDeck,
	isHanabiClueColor,
	isHanabiBlackPowderRuleSet,
	isHanabiFireworkCompletion,
	isHanabiRainbowRuleSet,
	isHanabiRuleSet,
} from './HanabiGameData.js';

function orderedTileTypes(ruleSet: HanabiRuleSet, seed: string) {
	const [tiles, tileIds] = generateRandomDeck(ruleSet, seed);
	return tileIds.map((id) => `${tiles[id].color}-${tiles[id].number}`);
}

describe('Hanabi game data', () => {
	it('creates the current setup defaults', () => {
		const data = generateHanabiGameData({ seed: 'fixed-seed' });

		expect(data).toMatchObject({
			seed: 'fixed-seed',
			ruleSet: '5-color',
			stage: HanabiStage.Setup,
			clues: HANABI_MAX_CLUES,
			lives: HANABI_MAX_LIVES,
			players: {},
			remainingTiles: [],
		});
	});

	it.each([
		['5-color', 50],
		['6-color', 60],
		['rainbow', 60],
		['black-powder', 60],
		['rainbow-black-powder', 70],
	] as const)('creates the expected %s deck composition', (ruleSet, expectedSize) => {
		const [tiles, tileIds] = generateRandomDeck(ruleSet, 'deck-seed');
		const counts = Object.values(tiles).reduce<Record<number, number>>((result, tile) => {
			result[tile.number] = (result[tile.number] ?? 0) + 1;
			return result;
		}, {});

		expect(Object.keys(tiles)).toHaveLength(expectedSize);
		expect(tileIds).toHaveLength(expectedSize);
		expect(counts).toEqual(
			ruleSet === '5-color'
				? { 1: 15, 2: 10, 3: 10, 4: 10, 5: 5 }
				: ruleSet === 'black-powder'
					? { 1: 16, 2: 12, 3: 12, 4: 12, 5: 8 }
					: ruleSet === 'rainbow-black-powder'
						? { 1: 19, 2: 14, 3: 14, 4: 14, 5: 9 }
						: { 1: 18, 2: 12, 3: 12, 4: 12, 5: 6 },
		);
	});

	it('creates the reversed Black Powder tile distribution', () => {
		const [tiles] = generateRandomDeck('black-powder', 'deck-seed');
		const blackNumbers = Object.values(tiles)
			.filter((tile) => tile.color === 'black')
			.map((tile) => tile.number)
			.sort();

		expect(blackNumbers).toEqual([1, 2, 2, 3, 3, 4, 4, 5, 5, 5]);
	});

	it('includes complete rainbow and black suits in the combined deck', () => {
		const [tiles] = generateRandomDeck('rainbow-black-powder', 'deck-seed');
		const colors = Object.values(tiles).reduce<Record<string, number>>((result, tile) => {
			result[tile.color] = (result[tile.color] ?? 0) + 1;
			return result;
		}, {});

		expect(colors).toEqual({
			red: 10,
			blue: 10,
			green: 10,
			yellow: 10,
			white: 10,
			rainbow: 10,
			black: 10,
		});
	});

	it('orders tile types deterministically for a seed', () => {
		expect(orderedTileTypes('rainbow', 'same-seed')).toEqual(
			orderedTileTypes('rainbow', 'same-seed'),
		);
		expect(orderedTileTypes('rainbow', 'same-seed')).not.toEqual(
			orderedTileTypes('rainbow', 'different-seed'),
		);
	});

	it('adds notes without mutating existing notes', () => {
		const original = { colors: ['red'] as const, numbers: [1] as const };

		expect(addToTileNotes(original, 'blue', 2)).toEqual({
			colors: ['red', 'blue'],
			numbers: [1, 2],
		});
		expect(original).toEqual({ colors: ['red'], numbers: [1] });
	});

	it('describes the suits and completion targets for each rule set', () => {
		expect(getHanabiRuleSetColors('5-color')).toEqual(['red', 'blue', 'green', 'yellow', 'white']);
		expect(getHanabiRuleSetColors('black-powder')).toEqual([
			'red',
			'blue',
			'green',
			'yellow',
			'white',
			'black',
		]);
		expect(getHanabiCompletionTileCount('black-powder')).toBe(30);
		expect(getHanabiMaxScore('black-powder')).toBe(25);
		expect(getHanabiCompletionTileCount('rainbow-black-powder')).toBe(35);
		expect(getHanabiMaxScore('rainbow-black-powder')).toBe(30);
		expect(getHanabiMaxScore('6-color')).toBe(30);
		expect(isHanabiBlackPowderRuleSet('rainbow-black-powder')).toBe(true);
		expect(isHanabiRainbowRuleSet('rainbow-black-powder')).toBe(true);
	});

	it('scores Black Powder by penalizing missing black tiles', () => {
		const tiles = Object.fromEntries([
			...[1, 2, 3, 4, 5, 1, 2, 3, 4, 5, 1, 2, 3, 4, 5, 1, 2, 3].map((number, index) => [
				`colored-${index}`,
				{ id: `colored-${index}`, color: 'red' as const, number: number as 1 | 2 | 3 | 4 | 5 },
			]),
			...[5, 4, 3].map((number) => [
				`black-${number}`,
				{ id: `black-${number}`, color: 'black' as const, number: number as 3 | 4 | 5 },
			]),
		]);
		const playedTiles = Object.keys(tiles);

		expect(
			getHanabiScore({
				ruleSet: 'black-powder',
				tiles,
				playedTiles,
			}),
		).toBe(16);
		expect(getHanabiScore({ ruleSet: '6-color', tiles, playedTiles })).toBe(21);
		expect(getHanabiScore({ ruleSet: 'rainbow-black-powder', tiles, playedTiles })).toBe(16);
	});

	it('recognizes the tile that completes each firework direction', () => {
		expect(getHanabiFireworkSequence('red')).toEqual([1, 2, 3, 4, 5]);
		expect(getHanabiFireworkSequence('black')).toEqual([5, 4, 3, 2, 1]);
		expect(isHanabiFireworkCompletion({ id: 'red-5', color: 'red', number: 5 })).toBe(true);
		expect(isHanabiFireworkCompletion({ id: 'black-1', color: 'black', number: 1 })).toBe(true);
		expect(isHanabiFireworkCompletion({ id: 'black-5', color: 'black', number: 5 })).toBe(false);
	});

	it('keeps colorless Black Powder tiles out of the clue-color contract', () => {
		expect(isHanabiRuleSet('black-powder')).toBe(true);
		expect(isHanabiRuleSet('rainbow-black-powder')).toBe(true);
		expect(isHanabiRuleSet('unsupported')).toBe(false);
		expect(isHanabiClueColor('red')).toBe(true);
		expect(isHanabiClueColor('purple')).toBe(true);
		expect(isHanabiClueColor('black')).toBe(false);
		expect(isHanabiClueColor('rainbow')).toBe(false);
	});
});
