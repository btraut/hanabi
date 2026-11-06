// @vitest-environment happy-dom

import {
	generateHanabiGameData,
	HanabiFinishedReason,
	HanabiGameData,
	HanabiRuleSet,
	HanabiStage,
	HanabiTile,
} from '@hanabi/shared';
import { act, StrictMode } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { HanabiMobileTableau } from './HanabiDesktopTableau';

function makeGame(tiles: HanabiTile[], discards: string[] = []): HanabiGameData {
	return generateHanabiGameData({
		tiles: Object.fromEntries(tiles.map((tile) => [tile.id, tile])),
		discardedTiles: discards,
	});
}

describe('compact mobile tableau', () => {
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

	function render(gameData: HanabiGameData, transitioningTileId: string | null = null): void {
		act(() =>
			root.render(
				<StrictMode>
					<HanabiMobileTableau gameData={gameData} transitioningTileId={transitioningTileId} />
				</StrictMode>,
			),
		);
	}

	function pile(color: string): HTMLButtonElement {
		return document.querySelector<HTMLButtonElement>(`button[aria-label^="${color} firework"]`)!;
	}

	it.each<[HanabiRuleSet, string[]]>([
		['5-color', ['red', 'blue', 'green', 'yellow', 'white']],
		['6-color', ['red', 'blue', 'green', 'yellow', 'white', 'purple']],
		['rainbow', ['red', 'blue', 'green', 'yellow', 'white', 'rainbow']],
		['black-powder', ['red', 'blue', 'green', 'yellow', 'white', 'black']],
		['rainbow-black-powder', ['red', 'blue', 'green', 'yellow', 'white', 'rainbow', 'black']],
	])(
		'shows every pile for %s without reserving a discard row before the first discard',
		(ruleSet, colors) => {
			render(generateHanabiGameData({ ruleSet }));
			const buttons = [...document.querySelectorAll<HTMLButtonElement>('#mount button')];
			expect(buttons.map((button) => button.getAttribute('aria-label')?.split(' ')[0])).toEqual(
				colors,
			);
			expect(document.querySelector('.hanabi-mobile-discards')).toBeNull();
			for (const color of colors)
				expect(pile(color).getAttribute('aria-label')).toContain('Discards, oldest first: none.');
		},
	);

	it('keeps every discard in its original per-color order, including repeated values and long piles', () => {
		const redNumbers = [4, 1, 3, 1, 2, 4, 3, 2, 1, 5] as const;
		const redTiles = redNumbers.map((number, index): HanabiTile => ({
			id: `red-${index}`,
			color: 'red',
			number,
		}));
		const blue: HanabiTile = { id: 'blue', color: 'blue', number: 2 };
		const discards = [redTiles[0].id, blue.id, ...redTiles.slice(1).map((tile) => tile.id)];
		render(makeGame([...redTiles, blue], discards));
		const numbers = [...pile('red').querySelectorAll('[data-discard-tile]')];
		expect(numbers.map((number) => number.getAttribute('data-discard-tile'))).toEqual(
			redTiles.map((tile) => tile.id),
		);
		expect(numbers.map((number) => Number(number.textContent))).toEqual(redNumbers);
		expect(pile('red').getAttribute('aria-label')).toContain('4, 1, 3, 1, 2, 4, 3, 2, 1, 5');
		expect(pile('blue').querySelectorAll('[data-discard-tile]')).toHaveLength(1);
	});

	it('moves the outgoing card identity to the newly appended number and clears it after the transition', () => {
		const tiles: HanabiTile[] = [
			{ id: 'earlier', color: 'red', number: 2 },
			{ id: 'outgoing', color: 'red', number: 4 },
		];
		const game = makeGame(tiles, ['earlier']);
		render(game);
		expect(pile('red').textContent).not.toContain('4');
		const next = { ...game, discardedTiles: ['earlier', 'outgoing'] };
		render(next, 'outgoing');
		const destination = pile('red').querySelector<HTMLElement>('[data-discard-tile="outgoing"]')!;
		expect(destination.textContent).toBe('4');
		expect(destination.style.viewTransitionName).toBe('hanabi-tile-outgoing');
		expect(
			[...document.querySelectorAll<HTMLElement>('#mount *')].filter(
				(element) => element.style.viewTransitionName,
			),
		).toHaveLength(1);
		render(next);
		expect(destination.style.viewTransitionName).toBe('');
		expect(destination.textContent).toBe('4');
	});

	it('uses the descending black firework top as the play destination', () => {
		const tiles: HanabiTile[] = [5, 4, 3].map((number) => ({
			id: `black-${number}`,
			color: 'black',
			number: number as 3 | 4 | 5,
		}));
		const game = {
			...makeGame(tiles),
			ruleSet: 'black-powder' as const,
			playedTiles: ['black-3', 'black-5', 'black-4'],
		};
		render(game, 'black-3');
		expect(pile('black').getAttribute('aria-label')).toContain('black firework at 3');
		expect(pile('black').querySelector('.hanabi-tile-number')?.textContent).toBe('3');
		expect(
			pile('black').querySelector<HTMLElement>('.hanabi-tile-shell')?.style.viewTransitionName,
		).toBe('hanabi-tile-black-3');
	});

	it('opens an inspectable pile, updates its cards during a live discard, and returns focus on dismissal', () => {
		const tiles: HanabiTile[] = [
			{ id: 'played', color: 'red', number: 1 },
			{ id: 'earlier', color: 'red', number: 4 },
			{ id: 'new', color: 'red', number: 2 },
		];
		const game = { ...makeGame(tiles, ['earlier']), playedTiles: ['played'] };
		render(game);
		const trigger = pile('red');
		trigger.focus();
		act(() => trigger.click());
		const dialog = document.querySelector('[role="dialog"]')!;
		expect(dialog.querySelector('h1')?.textContent).toBe('Red pile');
		expect(
			[...dialog.querySelectorAll('.hanabi-tile-number')].map((number) => number.textContent),
		).toEqual(['1', '4']);
		render({ ...game, discardedTiles: ['earlier', 'new'] }, 'new');
		expect(
			[...dialog.querySelectorAll('.hanabi-tile-number')].map((number) => number.textContent),
		).toEqual(['1', '4', '2']);
		// The detail sheet must not create a second destination with the same name.
		expect(
			[...dialog.querySelectorAll<HTMLElement>('*')].filter(
				(element) => element.style.viewTransitionName,
			),
		).toHaveLength(0);
		act(() => {
			document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
		});
		expect(document.querySelector('[role="dialog"]')).toBeNull();
		expect(document.activeElement).toBe(trigger);
	});

	it('closes an open inspector when the game ends and allows inspecting the finished game', () => {
		const game = { ...makeGame([]), stage: HanabiStage.Playing };
		render(game);
		act(() => pile('red').click());
		expect(document.querySelector('[role="dialog"]')).not.toBeNull();
		expect(document.body.style.overflow).toBe('hidden');

		render({
			...game,
			stage: HanabiStage.Finished,
			finishedReason: HanabiFinishedReason.OutOfLives,
		});
		expect(document.querySelector('[role="dialog"]')).toBeNull();
		expect(document.body.style.overflow).toBe('');

		act(() => pile('red').click());
		expect(document.querySelector('[role="dialog"] h1')?.textContent).toBe('Red pile');
	});
});
