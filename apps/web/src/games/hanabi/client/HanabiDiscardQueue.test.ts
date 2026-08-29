import HanabiDiscardQueue, {
	getHanabiDiscardQueueGap,
} from '~/games/hanabi/client/HanabiDiscardQueue';
import { HanabiTile } from '@hanabi/shared';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

describe('getHanabiDiscardQueueGap', () => {
	it.each([
		[0, 2],
		[1, 2],
		[6, 2],
		[7, -3],
		[8, -7],
		[9, -11],
		[10, -17],
	])('uses a readable fixed-size spacing strategy for %i discards', (count, gap) => {
		expect(getHanabiDiscardQueueGap(count)).toBe(gap);
	});

	it('leaves an empty queue visually empty', () => {
		const markup = renderToStaticMarkup(
			createElement(HanabiDiscardQueue, { color: 'red', tiles: [] }),
		);

		expect(markup).toMatch(/^<div[^>]+><\/div>$/);
	});

	it('uses the canonical portrait card geometry', () => {
		const tile: HanabiTile = { color: 'red', id: 'red-2', number: 2 };
		const markup = renderToStaticMarkup(
			createElement(HanabiDiscardQueue, { color: 'red', tiles: [tile] }),
		);

		expect(markup).toContain('height:64px;width:50px');
	});

	it('pins the first and last of ten cards inside the available queue width', () => {
		const tiles: HanabiTile[] = Array.from({ length: 10 }, (_, index) => ({
			color: 'red',
			id: `red-${index}`,
			number: 1,
		}));
		const markup = renderToStaticMarkup(createElement(HanabiDiscardQueue, { color: 'red', tiles }));

		expect(markup).toContain('width:347px');
		expect(markup).toContain('left:0;');
		expect(markup).toContain('left:calc(100% - 50px)');
	});
});
