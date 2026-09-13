// @vitest-environment happy-dom

import { HANABI_RULE_SETS, HanabiRuleSet } from '@hanabi/shared';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import HanabiChooseRuleSetForm from './HanabiChooseRuleSetForm';

const messenger = { changeSettings: vi.fn().mockResolvedValue(undefined) };
vi.mock('~/games/hanabi/client/HanabiGameContext', () => ({
	useGameMessenger: () => messenger,
}));

describe('lobby rule selection', () => {
	let root: Root;
	beforeEach(() => {
		Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
		document.body.innerHTML = '<div id="mount"></div>';
		root = createRoot(document.querySelector('#mount')!);
		messenger.changeSettings.mockClear();
	});
	afterEach(() => {
		act(() => root.unmount());
		document.body.innerHTML = '';
	});
	function render(ruleSet: HanabiRuleSet) {
		act(() => root.render(<HanabiChooseRuleSetForm ruleSet={ruleSet} />));
	}
	function selected() {
		return document.querySelector<HTMLSelectElement>('select')!.value;
	}

	it('selects one rule set, sends it to the server, and follows remote changes', async () => {
		render('6-color');
		expect(selected()).toBe('6-color');
		await act(async () => {
			const select = document.querySelector<HTMLSelectElement>('select')!;
			select.value = 'rainbow';
			select.dispatchEvent(new Event('change', { bubbles: true }));
			await Promise.resolve();
		});
		expect(selected()).toBe('rainbow');
		expect(messenger.changeSettings).toHaveBeenCalledExactlyOnceWith({ ruleSet: 'rainbow' });
		render('black-powder');
		expect(selected()).toBe('black-powder');
		expect(messenger.changeSettings).toHaveBeenCalledTimes(1);
	});

	it('shows every variant with a description and its actual suits', () => {
		render('5-color');
		const expected = [
			['red', 'blue', 'green', 'yellow', 'white'],
			['red', 'blue', 'green', 'yellow', 'white', 'purple'],
			['red', 'blue', 'green', 'yellow', 'white', 'rainbow'],
			['red', 'blue', 'green', 'yellow', 'white', 'black'],
			['red', 'blue', 'green', 'yellow', 'white', 'rainbow', 'black'],
		];
		expect(document.querySelectorAll('option')).toHaveLength(5);
		for (const [index, ruleSet] of HANABI_RULE_SETS.entries()) {
			render(ruleSet);
			const select = document.querySelector<HTMLSelectElement>('select')!;
			expect(document.querySelector('label')?.htmlFor).toBe(select.id);
			expect(
				document.getElementById(select.getAttribute('aria-describedby')!)?.textContent,
			).toBeTruthy();
			const tiles = [...document.querySelectorAll('[data-hanabi-tile-color]')];
			expect(tiles.map((tile) => tile.getAttribute('data-hanabi-tile-color'))).toEqual(
				expected[index],
			);
			expect(tiles.slice(0, 5).map((tile) => tile.textContent)).toEqual(['1', '2', '3', '4', '5']);
			expect(document.querySelector('.hanabi-rule-preview')?.textContent).not.toContain(
				select.selectedOptions[0].textContent,
			);
		}
	});
});
