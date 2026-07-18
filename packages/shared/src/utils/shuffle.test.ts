import { describe, expect, it } from 'vitest';
import { shuffle, shuffleInPlace } from './shuffle.js';

describe('shuffle', () => {
	it('returns a deterministic order for a seed without changing the input', () => {
		const input = [1, 2, 3, 4, 5];

		expect(shuffle(input, 'hanabi')).toEqual([1, 3, 5, 2, 4]);
		expect(shuffle(input, 'hanabi')).toEqual([1, 3, 5, 2, 4]);
		expect(input).toEqual([1, 2, 3, 4, 5]);
	});

	it('shuffles an array in place when requested', () => {
		const input = [1, 2, 3, 4, 5];

		expect(shuffleInPlace(input, 'hanabi')).toBe(input);
		expect(input).toEqual([1, 3, 5, 2, 4]);
	});
});
