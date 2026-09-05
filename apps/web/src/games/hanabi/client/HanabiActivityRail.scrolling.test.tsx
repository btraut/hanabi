// @vitest-environment happy-dom

import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import HanabiActivityRail from './HanabiActivityRail';
import { HanabiHighlightContextProvider } from './HanabiHighlightContext';
import { getHanabiDesktopFixtures } from './dev/HanabiDesktopFixtures';

let root: Root;
let contentHeight: number;
let onResize: () => void;
const scrollTo = vi.fn();
const disconnect = vi.fn();

beforeEach(() => {
	(
		globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
	).IS_REACT_ACT_ENVIRONMENT = true;
	contentHeight = 200;
	scrollTo.mockClear();
	disconnect.mockClear();
	vi.stubGlobal(
		'ResizeObserver',
		class {
			constructor(callback: () => void) {
				onResize = callback;
			}
			observe = vi.fn();
			disconnect = disconnect;
		},
	);
	vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(200);
	vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(() => contentHeight);
	vi.spyOn(HTMLElement.prototype, 'scrollTo').mockImplementation(scrollTo);
	const mount = document.createElement('div');
	document.body.append(mount);
	root = createRoot(mount);
	const fixture = getHanabiDesktopFixtures().activity;
	act(() =>
		root.render(
			<HanabiHighlightContextProvider
				value={{
					highlightAction: () => {},
					highlightedAction: null,
					highlightedLabel: null,
					highlightedRecipientId: null,
					highlightedTiles: new Set(),
					highlightedTone: null,
				}}
			>
				<HanabiActivityRail
					gameData={fixture.gameData}
					userId={fixture.userId}
					composer="Chat input"
				/>
			</HanabiHighlightContextProvider>,
		),
	);
});

afterEach(() => {
	act(() => root.unmount());
	document.body.innerHTML = '';
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

it('initializes the bottom snap on first overflow, then leaves later scrolling to the browser', () => {
	expect(scrollTo).toHaveBeenLastCalledWith({ behavior: 'instant', top: 0 });
	scrollTo.mockClear();
	contentHeight = 600;
	act(() => onResize());
	expect(scrollTo).toHaveBeenCalledExactlyOnceWith({ behavior: 'instant', top: 400 });

	// Reading an older message must not trigger a programmatic jump on content growth.
	const scroller = document.querySelector<HTMLElement>('.hanabi-feed-transcript')!;
	scroller.scrollTop = 100;
	act(() => {
		scroller.dispatchEvent(new Event('scroll'));
	});
	scrollTo.mockClear();
	contentHeight = 1000;
	act(() => onResize());
	expect(scrollTo).not.toHaveBeenCalled();
});

it('disconnects size observation when the activity feed unmounts', () => {
	act(() => root.render(null));
	expect(disconnect).toHaveBeenCalledOnce();
});
