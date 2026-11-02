// @vitest-environment happy-dom

import { HanabiGameStore } from './HanabiGameStore';
import { HanabiGameContextProvider } from './HanabiGameContext';
import HanabiTileActionsTooltip, { HanabiTileActionsTooltipType } from './HanabiTileActionsTooltip';
import { HANABI_MAX_CLUES, HanabiGameData, generateHanabiGameData } from '@hanabi/shared';
import { act, createElement } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('HanabiTileActionsTooltip', () => {
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

	function renderTooltip(
		clues: number,
		overrides: Partial<HanabiGameData> = {},
		type = HanabiTileActionsTooltipType.Own,
	): ReturnType<typeof vi.fn> {
		const tile = { id: 'red-1', color: 'red' as const, number: 1 as const };
		const gameData = generateHanabiGameData({
			clues,
			tiles: { [tile.id]: tile },
			...overrides,
		});
		const onAction = vi.fn();

		act(() => {
			root.render(
				createElement(
					HanabiGameContextProvider,
					{
						value: {
							code: 'test',
							create: vi.fn(),
							store: new HanabiGameStore(gameData),
							gameMessenger: null,
							watch: vi.fn(),
						},
					},
					createElement(HanabiTileActionsTooltip, {
						coords: { left: 100, top: 100 },
						onAction,
						onClose: vi.fn(),
						tileId: tile.id,
						type,
					}),
				),
			);
		});
		return onAction;
	}

	it('shows recorded clues beside the own-card actions without revealing the card', () => {
		const onAction = renderTooltip(HANABI_MAX_CLUES - 1, {
			showNotes: true,
			tileNotes: { 'red-1': { colors: ['blue'], numbers: [4] } },
		});

		const notes = document.querySelector('[aria-label="Recorded clues"]');
		expect(notes?.textContent).toContain('Color clues: blue. Number clues: 4.');
		expect(notes?.textContent).not.toContain('red');
		expect(notes?.querySelector('.bg-blue-500.opacity-30')).toBeNull();
		expect(notes?.querySelector('.bg-red-500.opacity-30')).not.toBeNull();
		expect(onAction).not.toHaveBeenCalled();

		act(() =>
			Array.from(document.querySelectorAll('button'))
				.find((button) => button.textContent === 'Play')!
				.click(),
		);
		expect(onAction).toHaveBeenCalledWith('play', { id: 'red-1', color: 'red', number: 1 });
	});

	it('describes an own card with no recorded clues', () => {
		renderTooltip(HANABI_MAX_CLUES, { showNotes: true });

		expect(document.querySelector('[aria-label="Recorded clues"]')?.textContent).toContain(
			'No clues recorded for this card.',
		);
	});

	it('respects games with notes disabled', () => {
		renderTooltip(HANABI_MAX_CLUES, {
			showNotes: false,
			tileNotes: { 'red-1': { colors: ['blue'], numbers: [4] } },
		});

		expect(document.querySelector('[aria-label="Recorded clues"]')).toBeNull();
	});

	it("keeps recorded notes out of another player's clue actions", () => {
		renderTooltip(HANABI_MAX_CLUES, { showNotes: true }, HanabiTileActionsTooltipType.OtherPlayer);

		expect(document.querySelector('[aria-label="Recorded clues"]')).toBeNull();
	});

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
