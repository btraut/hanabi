import HanabiTileNotesTooltip, { getHanabiTileNotesDescription } from './HanabiTileNotesTooltip';
import { ComponentProps, createElement, ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('~/components/Portal', () => ({
	default: ({ children }: { children: ReactNode }) => children,
}));
vi.mock('~/components/Tooltip', () => ({
	default: ({ children }: { children: ReactNode }) => children,
}));
vi.mock('~/games/hanabi/client/HanabiGameContext', () => ({
	useBoardData: () => ({ ruleSet: '5-color' }),
}));

function renderTooltip(props: Partial<ComponentProps<typeof HanabiTileNotesTooltip>> = {}) {
	return renderToStaticMarkup(
		createElement(HanabiTileNotesTooltip, {
			notes: { colors: ['blue'], numbers: [4] },
			coords: { left: 100, top: 100 },
			onClose: () => {},
			...props,
		}),
	);
}

describe('HanabiTileNotesTooltip accessibility', () => {
	it('renders the stored notes with an accessible description', () => {
		const markup = renderTooltip();

		expect(markup).toContain('role="tooltip"');
		expect(markup).toContain('aria-live="polite"');
		expect(markup).toContain('<span class="sr-only">Color clues: blue. Number clues: 4.</span>');
		expect(markup).toContain('bg-blue-500');
		expect(markup).toContain('>4<');
	});

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
