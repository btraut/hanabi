import HanabiTileView from './HanabiTileView';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

describe('HanabiTileView artwork', () => {
	it('keeps the live numeral above an aria-hidden face motif', () => {
		const markup = renderToStaticMarkup(createElement(HanabiTileView, { color: 'red', number: 3 }));

		expect(markup).toContain('>3<');
		expect(markup).toContain('tile-face-burst.svg');
		expect(markup).toContain('aria-hidden="true"');
	});

	it('distinguishes a concealed tile from an empty firework placeholder', () => {
		const concealed = renderToStaticMarkup(createElement(HanabiTileView));
		const placeholder = renderToStaticMarkup(createElement(HanabiTileView, { placeholder: true }));

		expect(concealed).toContain('tile-back-emblem.svg');
		expect(placeholder).not.toContain('tile-back-emblem.svg');
		expect(placeholder).toContain('hanabi-firework-placeholder');
	});
});
