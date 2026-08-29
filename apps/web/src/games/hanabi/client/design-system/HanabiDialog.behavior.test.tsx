// @vitest-environment happy-dom

import { act, useState } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import HanabiDialog from './HanabiDialog';

function DialogHarness(): JSX.Element {
	const [open, setOpen] = useState(false);

	return (
		<>
			<button id="dialog-trigger" onClick={() => setOpen(true)} type="button">
				Open dialog
			</button>
			{open && (
				<HanabiDialog onClose={() => setOpen(false)} title="Test dialog">
					<button type="button">Dialog action</button>
				</HanabiDialog>
			)}
		</>
	);
}

describe('HanabiDialog behavior', () => {
	let root: Root;

	beforeEach(() => {
		(
			globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
		).IS_REACT_ACT_ENVIRONMENT = true;
		document.body.innerHTML = '<div id="mount"></div><div id="portal"></div>';
		root = createRoot(document.querySelector('#mount')!);
		act(() => root.render(<DialogHarness />));
	});

	afterEach(() => {
		act(() => root.unmount());
		document.body.innerHTML = '';
	});

	function openDialog(): HTMLButtonElement {
		const trigger = document.querySelector<HTMLButtonElement>('#dialog-trigger')!;
		trigger.focus();
		act(() => trigger.click());
		expect(document.querySelector('[role="dialog"]')).not.toBeNull();
		return trigger;
	}

	it('dismisses with Escape and returns focus to its trigger', () => {
		const trigger = openDialog();

		act(() => {
			document.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Escape' }));
		});

		expect(document.querySelector('[role="dialog"]')).toBeNull();
		expect(document.activeElement).toBe(trigger);
	});

	it('dismisses pointer input on the backdrop but not inside the dialog', () => {
		openDialog();
		const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!;
		const backdrop = document.querySelector<HTMLElement>('.hanabi-dialog-backdrop')!;

		act(() => {
			dialog.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
		});
		expect(document.querySelector('[role="dialog"]')).not.toBeNull();

		act(() => {
			backdrop.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
		});
		expect(document.querySelector('[role="dialog"]')).toBeNull();
	});

	it('dismisses from the upper-right close control', () => {
		openDialog();
		const close = document.querySelector<HTMLButtonElement>('[aria-label="Close dialog"]')!;

		act(() => close.click());

		expect(document.querySelector('[role="dialog"]')).toBeNull();
	});
});
