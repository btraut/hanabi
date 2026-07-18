import { describe, expect, it } from 'vitest';
import { generateGameCode } from './generateGameCode.js';

describe('generateGameCode', () => {
	it('uses the current four-character default and unambiguous alphabet', () => {
		for (let index = 0; index < 100; index += 1) {
			expect(generateGameCode()).toMatch(/^[23456789abdegjkmnpqrvwxyz]{4}$/);
		}
	});

	it('preserves requested lengths, including zero', () => {
		expect(generateGameCode(8)).toHaveLength(8);
		expect(generateGameCode(0)).toBe('');
	});
});
