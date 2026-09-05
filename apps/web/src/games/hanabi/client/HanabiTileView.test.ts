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
		const visibleFace = renderToStaticMarkup(
			createElement(HanabiTileView, { color: 'red', number: 3, notesIndicator: true }),
		);

		expect(markup).toContain('tile-back-firework-v5.png');
		expect(markup).toContain('hanabi-tile-emphasis');
		expect(markup).toContain('hanabi-tile-emphasis-action');
		expect(markup).toContain('hanabi-tile-emphasis-mark');
		expect(markup).toContain('--hanabi-tile-note-fold-size:15px');
		expect(markup).toContain('hanabi-tile-shell');
		expect(markup).toContain('hanabi-tile-surface');
		expect(markup).toContain('hanabi-tile-surface-clipped');
		expect(markup).toContain('hanabi-tile-note-marker');
		expect(markup).toContain('viewBox="0 0 15 15"');
		expect(markup).toContain('hanabi-tile-note-shadow');
		expect(markup).toContain('<feGaussianBlur');
		expect(markup).toContain('transform="translate(');
		expect(markup).not.toContain('hanabi-tile-note-underfold');
		expect(markup).toContain('hanabi-tile-note-paper');
		expect(markup).not.toContain('hanabi-tile-note-highlight');
		expect(markup).not.toContain('hanabi-tile-note-crease');
		expect(markup.indexOf('hanabi-tile-note-shadow')).toBeLessThan(
			markup.indexOf('hanabi-tile-note-paper'),
		);
		expect(markup).not.toContain('hanabi-clue-token');
		expect(markup).not.toContain('MagnifyingGlass');
		expect(visibleFace).not.toContain('hanabi-tile-note-marker');
		expect(visibleFace).not.toContain('hanabi-tile-surface-clipped');
	});

	it('scopes the folded-corner paint definitions to each concealed tile', () => {
		const markup = renderToStaticMarkup(
			createElement(
				'div',
				null,
				createElement(HanabiTileView, { notesIndicator: true }),
				createElement(HanabiTileView, { notesIndicator: true }),
			),
		);
		const paperIds = [...markup.matchAll(/<(?:linear|radial)Gradient id="([^"]+)"/g)].map(
			(match) => match[1],
		);
		const shadowIds = [...markup.matchAll(/<filter id="([^"]+)"/g)].map((match) => match[1]);

		expect(new Set(paperIds).size).toBe(2);
		expect(new Set(shadowIds).size).toBe(2);
		for (const id of [...paperIds, ...shadowIds]) expect(markup).toContain(`url(#${id})`);
	});
});
