import { describe, expect, it } from 'vitest';
import {
	HANABI_MAX_CLUES,
	HANABI_MAX_LIVES,
	HanabiStage,
	addToTileNotes,
	generateHanabiGameData,
	generateRandomDeck,
} from './HanabiGameData.js';

function orderedTileTypes(ruleSet: '5-color' | '6-color' | 'rainbow', seed: string) {
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
				: { 1: 18, 2: 12, 3: 12, 4: 12, 5: 6 },
		);
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
});
