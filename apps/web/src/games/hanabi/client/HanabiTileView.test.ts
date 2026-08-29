import HanabiTileView from './HanabiTileView';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

describe('HanabiTileView artwork', () => {
	it('keeps the live numeral above a flattened authored face', () => {
		const markup = renderToStaticMarkup(createElement(HanabiTileView, { color: 'red', number: 3 }));

		expect(markup).toContain('>3<');
		expect(markup).toContain('/card-faces/red.png');
		expect(markup).not.toContain('hanabi-tile-art');
		expect(markup).not.toContain('shadow-light');
		expect(markup).toContain('--hanabi-tile-number-size:19.2px');
		expect(markup).toContain('width:40px;height:51.2px');
		expect(markup).not.toContain('text-3xl');
	});

	it('scales the numeral from the card width for custom dimensions', () => {
		const markup = renderToStaticMarkup(
			createElement(HanabiTileView, {
				color: 'green',
				dimensions: { height: 64, width: 50 },
				number: 4,
			}),
		);

		expect(markup).toContain('--hanabi-tile-number-size:24px');
		expect(markup).not.toContain('text-[29px]');
		expect(markup).not.toContain('text-[36px]');
	});

	it('distinguishes a concealed tile from an empty firework placeholder', () => {
		const concealed = renderToStaticMarkup(createElement(HanabiTileView));
		const placeholder = renderToStaticMarkup(createElement(HanabiTileView, { placeholder: true }));

		expect(concealed).toContain('tile-back-firework-v5.png');
		expect(placeholder).not.toContain('tile-back-firework-v5.png');
		expect(placeholder).toContain('hanabi-firework-placeholder');
	});

	it('keeps concealed artwork when highlight and note treatments are present', () => {
		const markup = renderToStaticMarkup(
			createElement(HanabiTileView, { highlight: true, notesIndicator: true }),
		);

		expect(markup).toContain('tile-back-firework-v5.png');
		expect(markup).toContain('hanabi-tile-emphasis');
		expect(markup).toContain('hanabi-tile-emphasis-action');
		expect(markup).toContain('hanabi-tile-note-marker');
		expect(markup).not.toContain('MagnifyingGlass');
	});
});
