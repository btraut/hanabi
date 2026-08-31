import { shouldShowTileOverlay } from './HanabiBoard';
import HanabiDesktopBoard from './HanabiDesktopBoard';
import { generateHanabiGameData } from '@hanabi/shared';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Hanabi board responsive layout', () => {
	it('hides every tile overlay while a tile is being dragged', () => {
		const overlay = { tileId: 'tile-1' };

		expect(shouldShowTileOverlay(overlay, false)).toBe(true);
		expect(shouldShowTileOverlay(overlay, true)).toBe(false);
		expect(shouldShowTileOverlay(null, false)).toBe(false);
	});

	it('keeps the tile action host mounted while a drag is active', () => {
		const source = readFileSync(new URL('./HanabiBoard.tsx', import.meta.url), 'utf8');

		expect(source).toContain('gameData.finishedReason === null ? handleTileClick : undefined');
		expect(source).not.toContain(
			'gameData.finishedReason === null && !isDraggingTile ? handleTileClick : undefined',
		);
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

	it('places activity beside gameplay instead of occupying the status row', () => {
		const markup = renderToStaticMarkup(
			createElement(HanabiDesktopBoard, {
				gameData: generateHanabiGameData(),
				userId: 'player-1',
			}),
		);

		expect(markup).toContain('class="col-start-3 row-start-2 min-w-0"');
		expect(markup).not.toContain('row-span-2 row-start-1');
	});
});
