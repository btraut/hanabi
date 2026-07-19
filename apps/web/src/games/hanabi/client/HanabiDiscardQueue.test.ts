import { getHanabiDiscardQueueGap } from '~/games/hanabi/client/HanabiDiscardQueue';
import { describe, expect, it } from 'vitest';

describe('getHanabiDiscardQueueGap', () => {
	it.each([
		[0, 3],
		[1, 3],
		[6, 3],
		[7, 0],
		[8, -3],
		[9, -5],
		[10, -8],
	])('uses a readable fixed-size spacing strategy for %i discards', (count, gap) => {
		expect(getHanabiDiscardQueueGap(count)).toBe(gap);
	});
});
