import { shouldShowTileOverlay } from './HanabiBoard';
import { getHanabiBoardLayout } from './HanabiBoardLayout';
import HanabiDesktopBoard from './HanabiDesktopBoard';
import { generateHanabiGameData } from '@hanabi/shared';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

describe('Hanabi board responsive layout', () => {
	it('hides every tile overlay while a tile is being dragged', () => {
		const overlay = { tileId: 'tile-1' };

		expect(shouldShowTileOverlay(overlay, false)).toBe(true);
		expect(shouldShowTileOverlay(overlay, true)).toBe(false);
		expect(shouldShowTileOverlay(null, false)).toBe(false);
	});

	it('keeps one modern composition and reports the active responsive mode', () => {
		expect(getHanabiBoardLayout({ md: false, xl: false })).toBe('mobile');
		expect(getHanabiBoardLayout({ md: true, xl: false })).toBe('tablet');
		expect(getHanabiBoardLayout({ md: true, xl: true })).toBe('desktop');
	});

	it('starts the tableau and player workspace stacks on the same grid row', () => {
		const markup = renderToStaticMarkup(
			createElement(HanabiDesktopBoard, {
				gameData: generateHanabiGameData(),
				userId: 'player-1',
			}),
		);

		expect(markup).toContain('data-desktop-region="tableau"');
		expect(markup).toContain('data-desktop-region="workspaces"');
		expect(markup).not.toContain('mt-[25px]');
	});
});
