// @vitest-environment happy-dom

import HanabiInteractiveTileView from './HanabiInteractiveTileView';
import { HANABI_TILE_LONG_PRESS_DELAY_MS } from './HanabiTouchInteractions';
import { act, createElement } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('~/games/hanabi/client/useTileDrag', () => ({
	default: () => ({ isDragging: false, dragRef: vi.fn() }),
}));

const tile = { id: 'red-1', color: 'red' as const, number: 1 as const };

function touchPointerEvent(
	type: 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel',
	coords: { x: number; y: number },
): PointerEvent {
	return new PointerEvent(type, {
		bubbles: true,
		cancelable: true,
		clientX: coords.x,
		clientY: coords.y,
		pointerId: 7,
		pointerType: 'touch',
	});
}

describe('HanabiInteractiveTileView touch gestures', () => {
	let root: Root;

	beforeEach(() => {
		(
			globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
		).IS_REACT_ACT_ENVIRONMENT = true;
		document.body.innerHTML = '<div id="mount"></div>';
		root = createRoot(document.querySelector('#mount')!);
		vi.useFakeTimers();
	});

	afterEach(() => {
		act(() => root.unmount());
		vi.useRealTimers();
		document.body.innerHTML = '';
	});

	function renderTile(): {
		button: HTMLButtonElement;
		onClick: ReturnType<typeof vi.fn>;
		onLongPress: ReturnType<typeof vi.fn>;
		onMouseDown: ReturnType<typeof vi.fn>;
	} {
		const onClick = vi.fn<(event: React.MouseEvent<HTMLElement>, tileId: string) => void>();
		const onLongPress = vi.fn<(element: HTMLElement, tileId: string) => void>();
		const onMouseDown = vi.fn<(event: React.MouseEvent<HTMLElement>, tileId: string) => void>();
		act(() => {
			root.render(
				createElement(HanabiInteractiveTileView, {
					draggable: true,
					onClick,
					onLongPress,
					onMouseDown,
					tile,
				}),
			);
		});
		return {
			button: document.querySelector('button')!,
			onClick,
			onLongPress,
			onMouseDown,
		};
	}

	it('keeps a short tap as the existing tile action click', () => {
		const { button, onClick, onLongPress } = renderTile();

		act(() => {
			button.dispatchEvent(touchPointerEvent('pointerdown', { x: 20, y: 30 }));
			vi.advanceTimersByTime(HANABI_TILE_LONG_PRESS_DELAY_MS - 1);
			button.dispatchEvent(touchPointerEvent('pointerup', { x: 20, y: 30 }));
			button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 }));
		});

		expect(onLongPress).not.toHaveBeenCalled();
		expect(onClick).toHaveBeenCalledOnce();
		expect(onClick).toHaveBeenCalledWith(expect.anything(), tile.id);
	});

	it('opens clue details after a stationary hold and suppresses compatibility mouse input', () => {
		const { button, onClick, onLongPress, onMouseDown } = renderTile();

		act(() => {
			button.dispatchEvent(touchPointerEvent('pointerdown', { x: 20, y: 30 }));
			vi.advanceTimersByTime(HANABI_TILE_LONG_PRESS_DELAY_MS);
		});

		expect(onLongPress).toHaveBeenCalledOnce();
		expect(onLongPress).toHaveBeenCalledWith(button, tile.id);

		act(() => {
			button.dispatchEvent(touchPointerEvent('pointerup', { x: 20, y: 30 }));
			button.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
			button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 }));
		});

		expect(onMouseDown).toHaveBeenCalledOnce();
		expect(onClick).not.toHaveBeenCalled();
	});

	it('keeps click suppression armed for however long the finger stays down', () => {
		const { button, onClick, onLongPress } = renderTile();

		act(() => {
			button.dispatchEvent(touchPointerEvent('pointerdown', { x: 20, y: 30 }));
			vi.advanceTimersByTime(HANABI_TILE_LONG_PRESS_DELAY_MS + 5_000);
			button.dispatchEvent(touchPointerEvent('pointerup', { x: 20, y: 30 }));
			button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 }));
		});

		expect(onLongPress).toHaveBeenCalledOnce();
		expect(onClick).not.toHaveBeenCalled();
	});

	it('cancels the hold and action click once movement becomes a drag', () => {
		const { button, onClick, onLongPress } = renderTile();

		act(() => {
			button.dispatchEvent(touchPointerEvent('pointerdown', { x: 20, y: 30 }));
			button.dispatchEvent(touchPointerEvent('pointermove', { x: 29, y: 30 }));
			vi.advanceTimersByTime(HANABI_TILE_LONG_PRESS_DELAY_MS);
			button.dispatchEvent(touchPointerEvent('pointerup', { x: 29, y: 30 }));
			button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 }));
		});

		expect(onLongPress).not.toHaveBeenCalled();
		expect(onClick).not.toHaveBeenCalled();
	});

	it('cleans up a canceled pointer without opening clue details', () => {
		const { button, onLongPress } = renderTile();

		act(() => {
			button.dispatchEvent(touchPointerEvent('pointerdown', { x: 20, y: 30 }));
			button.dispatchEvent(touchPointerEvent('pointercancel', { x: 20, y: 30 }));
			vi.advanceTimersByTime(HANABI_TILE_LONG_PRESS_DELAY_MS);
		});

		expect(onLongPress).not.toHaveBeenCalled();
	});

	it('leaves mouse clicks out of the long-press gesture path', () => {
		const { button, onClick, onLongPress } = renderTile();

		act(() => {
			button.dispatchEvent(
				new PointerEvent('pointerdown', {
					bubbles: true,
					pointerId: 1,
					pointerType: 'mouse',
				}),
			);
			vi.advanceTimersByTime(HANABI_TILE_LONG_PRESS_DELAY_MS);
			button.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
		});

		expect(onLongPress).not.toHaveBeenCalled();
		expect(onClick).toHaveBeenCalledOnce();
	});
});
