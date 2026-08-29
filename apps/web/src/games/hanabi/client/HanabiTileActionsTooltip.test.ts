// @vitest-environment happy-dom

import { HanabiGameContextProvider } from './HanabiGameContext';
import HanabiTileActionsTooltip, { HanabiTileActionsTooltipType } from './HanabiTileActionsTooltip';
import { HANABI_MAX_CLUES, generateHanabiGameData } from '@hanabi/shared';
import { act, createElement } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('HanabiTileActionsTooltip discard rule', () => {
	let root: Root;

	beforeEach(() => {
		(
			globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
		).IS_REACT_ACT_ENVIRONMENT = true;
		document.body.innerHTML = '<div id="mount"></div><div id="portal"></div>';
		root = createRoot(document.querySelector('#mount')!);
	});

	afterEach(() => {
		act(() => root.unmount());
		document.body.innerHTML = '';
	});

	function renderTooltip(clues: number): void {
		const tile = { id: 'red-1', color: 'red' as const, number: 1 as const };
		const gameData = generateHanabiGameData({
			clues,
			tiles: { [tile.id]: tile },
		});

		act(() => {
			root.render(
				createElement(
					HanabiGameContextProvider,
					{
						value: {
							code: 'test',
							create: vi.fn(),
							gameData,
							gameMessenger: null,
							transitioningTileId: null,
							watch: vi.fn(),
						},
					},
					createElement(HanabiTileActionsTooltip, {
						coords: { left: 100, top: 100 },
						onAction: vi.fn(),
						onClose: vi.fn(),
						tileId: tile.id,
						type: HanabiTileActionsTooltipType.Own,
					}),
				),
			);
		});
	}

	it('disables discard and focuses play when all eight clues are available', () => {
		renderTooltip(HANABI_MAX_CLUES);

		const discard = Array.from(document.querySelectorAll('button')).find(
			(button) => button.textContent === 'Discard',
		)!;
		const play = Array.from(document.querySelectorAll('button')).find(
			(button) => button.textContent === 'Play',
		)!;

		expect(discard.disabled).toBe(true);
		expect(discard.title).toBe('All 8 clues are already available.');
		expect(play.disabled).toBe(false);
		expect(document.activeElement).toBe(play);
	});

	it('keeps discard enabled when it can restore a clue', () => {
		renderTooltip(HANABI_MAX_CLUES - 1);

		const discard = Array.from(document.querySelectorAll('button')).find(
			(button) => button.textContent === 'Discard',
		)!;

		expect(discard.disabled).toBe(false);
		expect(document.activeElement).toBe(discard);
	});
});
