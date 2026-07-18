import { describe, expect, it } from 'vitest';
import { generateGameCode } from './generateGameCode.js';

describe('generateGameCode', () => {
	it('uses a six-character default, a cryptographic generator, and an unambiguous alphabet', () => {
		for (let index = 0; index < 100; index += 1) {
			expect(generateGameCode()).toMatch(/^[23456789abdegjkmnpqrvwxyz]{6}$/);
		}
	});

	it('preserves requested lengths, including zero', () => {
		expect(generateGameCode(8)).toHaveLength(8);
		expect(generateGameCode(0)).toBe('');
	});
});
