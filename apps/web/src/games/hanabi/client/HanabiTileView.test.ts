import HanabiTileView from './HanabiTileView';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { HANABI_CLUE_COLORS } from '@hanabi/shared';

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

describe('HanabiTileView temporary clues', () => {
	it.each(HANABI_CLUE_COLORS)(
		'shows the %s clue on a concealed back without notes or highlight',
		(color) => {
			const markup = renderToStaticMarkup(
				createElement(HanabiTileView, { recentClue: { type: 'color', value: color } }),
			);

			expect(markup).toContain(`data-hanabi-clue="color-${color}"`);
			expect(markup).toContain(`Latest clue: ${color}.`);
			expect(markup).toContain('hanabi-tile-back-color-clue');
			expect(markup).not.toContain('hanabi-tile-clue-number');
			expect(markup).not.toContain('hanabi-tile-note-marker');
			expect(markup).not.toContain('hanabi-tile-emphasis');
		},
	);

	it.each([1, 2, 3, 4, 5] as const)(
		'shows number %i while retaining the concealed back and note fold',
		(number) => {
			const markup = renderToStaticMarkup(
				createElement(HanabiTileView, {
					recentClue: { type: 'number', value: number },
					notesIndicator: true,
				}),
			);

			expect(markup).toContain(`data-hanabi-clue="number-${number}"`);
			expect(markup).toContain(`Latest clue: ${number}.`);
			expect(markup).toContain(`>${number}</span>`);
			expect(markup).toContain('hanabi-tile-clue-number');
			expect(markup).toContain('tile-back-firework-v5.png');
			expect(markup).toContain('hanabi-tile-note-marker');
			expect(markup).toContain('hanabi-tile-surface-clipped');
		},
	);

	it('does not paint clues over revealed faces or empty firework positions', () => {
		for (const props of [{ color: 'green', number: 4 } as const, { placeholder: true }]) {
			const markup = renderToStaticMarkup(
				createElement(HanabiTileView, {
					...props,
					recentClue: { type: 'number', value: 3 },
				}),
			);
			expect(markup).not.toContain('data-hanabi-clue');
			expect(markup).not.toContain('Latest clue:');
			expect(markup).not.toContain('hanabi-tile-clue-number');
		}
	});

	it('does not infer a clue from a highlight or recorded-note marker', () => {
		const markup = renderToStaticMarkup(
			createElement(HanabiTileView, {
				highlight: true,
				highlightTone: 'red',
				notesIndicator: true,
			}),
		);
		expect(markup).not.toContain('data-hanabi-clue');
		expect(markup).not.toContain('Latest clue:');
		expect(markup).not.toContain('hanabi-tile-back-color-clue');
	});
});
