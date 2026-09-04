// @vitest-environment happy-dom

import Tooltip from './Tooltip';
import { act, createElement } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('Tooltip touch dismissal', () => {
	let root: Root;

	beforeEach(() => {
		(
			globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
		).IS_REACT_ACT_ENVIRONMENT = true;
		document.body.innerHTML = '<div id="mount"></div>';
		root = createRoot(document.querySelector('#mount')!);
	});

	afterEach(() => {
		act(() => root.unmount());
		document.body.innerHTML = '';
	});

	it('dismisses on an outside pointer without closing for an inside pointer', () => {
		const onClose = vi.fn();
		act(() => {
			root.render(
				createElement(Tooltip, {
					children: createElement('span', null, 'Clues'),
					left: 100,
					onClose,
					top: 100,
				}),
			);
		});

		act(() => {
			document
				.querySelector('span')!
				.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch' }));
		});
		expect(onClose).not.toHaveBeenCalled();

		act(() => {
			document.body.dispatchEvent(
				new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch' }),
			);
		});
		expect(onClose).toHaveBeenCalledOnce();
	});
});
