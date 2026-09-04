import { getHanabiTileNotesDescription } from './HanabiTileNotesTooltip';
import { describe, expect, it } from 'vitest';

describe('HanabiTileNotesTooltip accessibility', () => {
	it('describes recorded color and number clues', () => {
		expect(
			getHanabiTileNotesDescription({
				colors: ['red', 'blue'],
				numbers: [2, 4],
			}),
		).toBe('Color clues: red, blue. Number clues: 2, 4.');
	});

	it('describes the absence of recorded clues', () => {
		expect(getHanabiTileNotesDescription(undefined)).toBe('No clues recorded for this card.');
		expect(getHanabiTileNotesDescription({ colors: [], numbers: [] })).toBe(
			'No clues recorded for this card.',
		);
	});
});
