// @vitest-environment happy-dom

import { act, ReactNode } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import HanabiTileNotesTooltip from './HanabiTileNotesTooltip';
import useTileNotesHandlers from './useTileNotesHandlers';

vi.mock('~/components/Portal', () => ({
	default: ({ children }: { children: ReactNode }) => children,
}));
vi.mock('~/games/hanabi/client/HanabiGameContext', () => ({
	useBoardData: () => ({
		ruleSet: '5-color',
		showNotes: true,
		tileNotes: { tile: { colors: ['blue'], numbers: [4] } },
	}),
}));

function NotesHarness(): JSX.Element {
	const { showNotesForTile, hideNotesForTile, handleTileMouseOver, handleTileLongPress } =
		useTileNotesHandlers();
	return (
		<>
			<button
				onMouseOver={(event) => handleTileMouseOver(event, 'tile')}
				onContextMenu={(event) => {
					event.preventDefault();
					handleTileLongPress(event.currentTarget, 'tile');
				}}
			>
				Card
			</button>
			{showNotesForTile && (
				<HanabiTileNotesTooltip
					notes={showNotesForTile.notes}
					coords={showNotesForTile.coords}
					position={showNotesForTile.position}
					onClose={hideNotesForTile}
				/>
			)}
		</>
	);
}

let root: Root;
let mount: HTMLDivElement;
let card: HTMLButtonElement;

beforeEach(() => {
	(
		globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
	).IS_REACT_ACT_ENVIRONMENT = true;
	vi.useFakeTimers();
	vi.spyOn(window, 'scrollY', 'get').mockReturnValue(120);
	mount = document.createElement('div');
	document.body.append(mount);
	root = createRoot(mount);
	act(() => root.render(<NotesHarness />));
	card = mount.querySelector('button')!;
	vi.spyOn(card, 'getBoundingClientRect').mockReturnValue(new DOMRect(160, 200, 50, 64));
});

afterEach(() => {
	act(() => root.unmount());
	mount.remove();
	vi.clearAllTimers();
	vi.useRealTimers();
	vi.restoreAllMocks();
});

it('anchors long-press notes above the card, including the page scroll offset', () => {
	act(() => {
		card.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
	});
	act(() => {
		vi.runOnlyPendingTimers();
	});
	const tooltip = mount.querySelector<HTMLElement>('[role="tooltip"]')!;
	const positioner = tooltip.parentElement!;

	expect(positioner.style.top).toBe('320px');
	expect(positioner.style.left).toBe('185px');
	expect(positioner.classList.contains('-translate-y-full')).toBe(true);
	expect(tooltip.classList.contains('mb-1')).toBe(true);
	expect(tooltip.textContent).toContain('Color clues: blue. Number clues: 4.');
});

it('anchors mouse-hover notes below the card, including the page scroll offset', () => {
	act(() => {
		card.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
	});
	act(() => {
		vi.runOnlyPendingTimers();
	});
	const tooltip = mount.querySelector<HTMLElement>('[role="tooltip"]')!;
	const positioner = tooltip.parentElement!;

	expect(positioner.style.top).toBe('384px');
	expect(positioner.style.left).toBe('185px');
	expect(positioner.classList.contains('-translate-y-full')).toBe(false);
	expect(tooltip.classList.contains('mt-1')).toBe(true);
});
