// @vitest-environment happy-dom

import {
	generateHanabiGameData,
	HanabiFinishedReason,
	HanabiGameActionType,
	HanabiGameData,
	HanabiStage,
} from '@hanabi/shared';
import { act, StrictMode } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import HanabiBoard from './HanabiBoard';

const mocks = vi.hoisted(() => ({
	useBoardData: vi.fn<() => HanabiGameData>(),
	userId: 'alice',
	reset: vi.fn<() => Promise<void>>(),
}));

vi.mock('~/components/SocketContext', () => ({ useUserId: () => mocks.userId }));
vi.mock('./HanabiGameContext', () => ({
	useBoardData: () => mocks.useBoardData(),
	useTransitioningTileId: () => null,
	useBotStatusData: () => ({}),
	useGameMessenger: () => ({ reset: mocks.reset }),
}));
vi.mock('react-dnd', () => ({ useDragLayer: () => false }));
vi.mock('./HanabiHighlightContext', () => ({
	useHanabiHighlightContext: () => ({ highlightedTiles: new Set(), highlightedTone: null }),
}));
vi.mock('./useLatestActions', () => ({ useLatestActionEffect: () => {} }));
vi.mock('./HanabiActionEffects', () => ({ default: () => null }));
vi.mock('./HanabiLiveActivityRail', () => ({ default: () => null }));
vi.mock('./HanabiLivePlayerWorkspace', () => ({ default: () => null }));
vi.mock('./HanabiPlayerWorkspace', () => ({ HanabiDesktopPlayerWorkspaces: () => null }));
vi.mock('./HanabiDesktopTableau', () => ({ default: () => null }));
vi.mock('./HanabiHeaderMenuButton', () => ({ default: () => null }));

function playingRound(startId = 'round-one'): HanabiGameData {
	return generateHanabiGameData({
		seed: '',
		stage: HanabiStage.Playing,
		currentPlayerId: 'alice',
		players: { alice: { id: 'alice', name: 'Alice', connected: true } },
		turnOrder: ['alice'],
		playerTiles: { alice: [] },
		actions: [{ id: startId, type: HanabiGameActionType.GameStarted, startingPlayerId: 'alice' }],
	});
}

const reasons = Object.values(HanabiFinishedReason);

// Keep the real board, status, popup, portal and dialog: StrictMode must exercise
// the same render/effect lifecycle as the application when a round finishes.
describe('Hanabi end-of-game results', () => {
	let root: Root;
	let game: HanabiGameData;
	let review: ReturnType<typeof vi.fn<() => void>>;

	beforeEach(() => {
		(
			globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
		).IS_REACT_ACT_ENVIRONMENT = true;
		document.body.innerHTML = '<div id="mount"></div><div id="portal"></div>';
		root = createRoot(document.querySelector('#mount')!);
		game = playingRound();
		mocks.userId = 'alice';
		mocks.useBoardData.mockImplementation(() => game);
		mocks.reset.mockReset().mockResolvedValue();
		review = vi.fn<() => void>();
	});

	afterEach(() => {
		act(() => root.unmount());
		document.body.innerHTML = '';
	});

	function render(initiallyDismissGameOver = false): void {
		act(() =>
			root.render(
				<StrictMode>
					<HanabiBoard onReview={review} initiallyDismissGameOver={initiallyDismissGameOver} />
				</StrictMode>,
			),
		);
	}

	function finish(reason: HanabiFinishedReason): void {
		game = {
			...game,
			stage: HanabiStage.Finished,
			finishedReason: reason,
			actions: [
				...game.actions,
				{
					id: `${game.actions[0].id}-finished`,
					type: HanabiGameActionType.GameFinished,
					finishedReason: reason,
				},
			],
		};
		render();
	}

	function dialog(): Element | null {
		return document.querySelector('[role="dialog"]');
	}

	function button(label: string): HTMLButtonElement | undefined {
		return [...document.querySelectorAll('button')].find((item) => item.textContent === label);
	}

	function dismiss(): void {
		const close = document.querySelector<HTMLButtonElement>('[aria-label="Close dialog"]');
		expect(close).not.toBeNull();
		act(() => close!.click());
		expect(dialog()).toBeNull();
	}

	it.each(reasons)('opens the results on a live %s finish under StrictMode', (reason) => {
		render();
		expect(dialog()).toBeNull();
		finish(reason);
		expect(dialog()).not.toBeNull();
		expect(dialog()?.querySelector('h1')?.textContent).toBe(
			reason === HanabiFinishedReason.Won ? 'You Win' : 'Game over',
		);
		expect(button('New game')).toBeDefined();
		expect(button('Review game')).toBeDefined();
	});

	it.each(reasons)('shows results when reconnecting to a finished %s round', (reason) => {
		game = {
			...game,
			stage: HanabiStage.Finished,
			finishedReason: reason,
			actions: [
				...game.actions,
				{
					id: `${game.actions[0].id}-finished`,
					type: HanabiGameActionType.GameFinished,
					finishedReason: reason,
				},
			],
		};
		render();
		expect(dialog()).not.toBeNull();
	});

	it('opens reconnect results when the portal root is mounted in the same React commit', () => {
		document.querySelector('#portal')!.remove();
		game = { ...game, stage: HanabiStage.Finished, finishedReason: HanabiFinishedReason.Won };
		act(() =>
			root.render(
				<StrictMode>
					<HanabiBoard onReview={review} />
					<div id="portal" />
				</StrictMode>,
			),
		);
		expect(dialog()?.querySelector('h1')?.textContent).toBe('You Win');
	});

	it('keeps dismissed results closed across same-round updates and allows reopening', () => {
		finish(HanabiFinishedReason.Won);
		dismiss();
		game = {
			...game,
			actions: [
				...game.actions,
				{ id: 'chat', type: HanabiGameActionType.Chat, playerId: 'alice', message: 'Good game!' },
			],
		};
		render();
		expect(dialog()).toBeNull();
		const resultTrigger = document.querySelector<HTMLButtonElement>(
			'[aria-label="You Win: show game result"]',
		);
		expect(resultTrigger).not.toBeNull();
		act(() => resultTrigger!.click());
		expect(dialog()).not.toBeNull();
	});

	it('opens another round with the same redacted seed and finishing reason after dismissal', () => {
		finish(HanabiFinishedReason.OutOfTurns);
		dismiss();
		game = playingRound('round-two');
		render();
		expect(dialog()).toBeNull();
		finish(HanabiFinishedReason.OutOfTurns);
		expect(dialog()).not.toBeNull();
	});

	it('keeps a reviewed finished round dismissed when returning to its board', () => {
		game = { ...game, stage: HanabiStage.Finished, finishedReason: HanabiFinishedReason.Won };
		render(true);
		expect(dialog()).toBeNull();
		game = { ...game };
		render(true);
		expect(dialog()).toBeNull();
	});

	it('closes results and opens review without resetting the game', () => {
		finish(HanabiFinishedReason.Won);
		act(() => button('Review game')!.click());
		expect(dialog()).toBeNull();
		expect(review).toHaveBeenCalledOnce();
		expect(mocks.reset).not.toHaveBeenCalled();
	});

	it('lets a seated player start a new game from the results', () => {
		finish(HanabiFinishedReason.DiscardedFatalTile);
		act(() => button('New game')!.click());
		expect(dialog()).toBeNull();
		expect(mocks.reset).toHaveBeenCalledOnce();
		expect(review).not.toHaveBeenCalled();
	});

	it('lets spectators review without offering to reset someone else’s game', () => {
		mocks.userId = 'spectator';
		finish(HanabiFinishedReason.Won);
		expect(button('New game')).toBeUndefined();
		expect(button('Review game')).toBeDefined();
	});
});
