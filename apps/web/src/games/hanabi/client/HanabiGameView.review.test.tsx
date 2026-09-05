// @vitest-environment happy-dom

import {
	GameTranscriptV1,
	HanabiGameData,
	HanabiStage,
	replayHanabiTranscript,
} from '@hanabi/shared';
import { act, ReactNode } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import HanabiGameView from './HanabiGameView';
import reviewTranscript from './dev/review-transcript.json';

const mocks = vi.hoisted(() => ({
	useGameData: vi.fn<() => HanabiGameData>(),
	board: vi.fn(),
	dropTarget: vi.fn(),
	messenger: { reset: vi.fn(), playTile: vi.fn(), discardTile: vi.fn(), giveClue: vi.fn() },
}));

vi.mock('./HanabiGameContext', () => ({
	useGameSelector: (select: (game: HanabiGameData) => unknown) => select(mocks.useGameData()),
	useGameMessenger: () => mocks.messenger,
}));
vi.mock('~/components/SocketContext', () => ({ useUserId: () => 'alice' }));
vi.mock('./useTileDrop', () => ({ default: () => mocks.dropTarget }));
vi.mock('./HanabiBoardPresentation', () => ({
	default: ({ children }: { children: ReactNode }) => children,
}));
vi.mock('./HanabiMoveTileController', () => ({
	default: ({ children }: { children: ReactNode }) => children,
}));
vi.mock('./HanabiHeader', () => ({ default: () => <header>Live game header</header> }));
vi.mock('./HanabiLobby', () => ({
	default: () => <section data-testid="lobby">Current lobby</section>,
}));
vi.mock('./HanabiDebugPanel', () => ({ default: () => null }));
vi.mock('./HanabiActionToasts', () => ({ HanabiLiveActionToasts: () => null }));
vi.mock('~/components/BreakpointController', () => ({
	default: ({ children }: { children: ReactNode }) => children,
}));
vi.mock('./HanabiHighlightController', () => ({
	default: ({ children }: { children: ReactNode }) => children,
}));
vi.mock('./HanabiBoard', () => ({
	default: (props: { onReview?: () => void; initiallyDismissGameOver?: boolean }) => {
		mocks.board(props);
		return (
			<section
				data-testid="live-board"
				data-dismiss-results={String(props.initiallyDismissGameOver)}
			>
				Live game board
				{props.onReview && <button onClick={props.onReview}>Review from results</button>}
			</section>
		);
	},
}));

const transcript = reviewTranscript as GameTranscriptV1;

describe('HanabiGameView review integration', () => {
	let root: Root;
	let liveGame: HanabiGameData;

	beforeEach(() => {
		(
			globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
		).IS_REACT_ACT_ENVIRONMENT = true;
		vi.clearAllMocks();
		vi.spyOn(HTMLElement.prototype, 'scrollIntoView').mockImplementation(() => {});
		liveGame = {
			...replayHanabiTranscript(transcript, transcript.moves.length),
			reviewTranscript: transcript,
		};
		mocks.useGameData.mockImplementation(() => liveGame);
		document.body.innerHTML = '<div id="mount"></div>';
		root = createRoot(document.querySelector('#mount')!);
	});

	afterEach(() => {
		act(() => root.unmount());
		for (const method of Object.values(mocks.messenger)) expect(method).not.toHaveBeenCalled();
		vi.restoreAllMocks();
		document.body.innerHTML = '';
	});

	function render(): void {
		act(() =>
			root.render(
				<MemoryRouter>
					<HanabiGameView />
				</MemoryRouter>,
			),
		);
	}

	function button(label: string): HTMLButtonElement | undefined {
		return [...document.querySelectorAll('button')].find((item) => item.textContent === label);
	}

	it.each(['error', 'exhausted', 'disabled'] as const)(
		'shows a nonblocking error with no retry control when bot status is %s',
		(status) => {
			liveGame.stage = HanabiStage.Playing;
			liveGame.finishedReason = null;
			liveGame.currentPlayerId = 'bot';
			liveGame.players = {
				...liveGame.players,
				bot: { id: 'bot', name: 'Bot', kind: 'bot', connected: true },
			};
			liveGame.bots = {
				available: true,
				canManage: false,
				turn: {
					playerId: 'bot',
					status,
					canRetry: false,
					message: 'Could not respond. Retrying automatically.',
				},
			};
			render();
			expect(document.querySelector('[data-testid="live-board"]')).not.toBeNull();
			expect(document.querySelector('[role="status"]')?.textContent).toBe(
				'Bot: Could not respond. Retrying automatically.',
			);
			expect(document.querySelector('[role="dialog"]')).toBeNull();
			expect(button('Retry')).toBeUndefined();
			const board = document.querySelector('[data-testid="live-board"]');
			liveGame.bots.turn!.status = 'thinking';
			render();
			expect(document.querySelector('[role="status"]')).toBeNull();
			expect(document.querySelector('[data-testid="live-board"]')).toBe(board);
		},
	);

	it('supplies an error fallback and hides it after the game finishes or for result reflections', () => {
		liveGame.stage = HanabiStage.Playing;
		liveGame.finishedReason = null;
		liveGame.bots = {
			available: true,
			canManage: false,
			turn: { playerId: 'bot', status: 'error', canRetry: false },
		};
		render();
		expect(document.querySelector('[role="status"]')?.textContent).toBe(
			'Bot: Could not respond. Retrying automatically.',
		);
		liveGame.bots.turn!.opportunity = 'result';
		render();
		expect(document.querySelector('[role="status"]')).toBeNull();
		liveGame.bots.turn!.opportunity = 'turn';
		liveGame.stage = HanabiStage.Finished;
		render();
		expect(document.querySelector('[role="status"]')).toBeNull();
	});

	function click(label: string): void {
		const element = button(label);
		expect(element, `Expected button ${label}`).toBeDefined();
		act(() => element!.click());
	}

	function cursor(): string | null | undefined {
		return document.querySelector('[data-review-cursor]')?.getAttribute('data-review-cursor');
	}

	it('opens an independent review through the results popup', () => {
		render();
		expect(document.querySelector('[data-testid="live-board"]')).not.toBeNull();
		click('Review from results');
		expect(cursor()).toBe('0');
		expect(document.querySelector('[data-testid="live-board"]')).toBeNull();
		expect(document.body.textContent).toContain('Game review');
		expect(document.querySelector('.hanabi-review-caption')?.textContent).toBe('Initial deal');
	});

	it('keeps the captured round and cursor when the live lobby resets, then reopens the old review', () => {
		render();
		click('Review from results');
		click('Next');
		click('Next');
		const caption = document.querySelector('.hanabi-review-caption')?.textContent;
		const playerHands = [...document.querySelectorAll('[data-review-player]')].map(
			(hand) => hand.innerHTML,
		);

		liveGame = {
			...liveGame,
			seed: 'new-round',
			stage: HanabiStage.Setup,
			reviewTranscript: undefined,
		};
		render();
		expect(cursor()).toBe('2');
		expect(document.querySelector('.hanabi-review-caption')?.textContent).toBe(caption);
		expect(
			[...document.querySelectorAll('[data-review-player]')].map((hand) => hand.innerHTML),
		).toEqual(playerHands);
		expect(document.querySelector('[data-testid="lobby"]')).toBeNull();
		click('← Back to lobby');
		expect(cursor()).toBeUndefined();
		expect(document.querySelector('[data-testid="lobby"]')?.textContent).toBe('Current lobby');
		click('Review previous game');
		expect(cursor()).toBe('0');
		click('Next');
		click('Next');
		expect(document.querySelector('.hanabi-review-caption')?.textContent).toBe(caption);
	});

	it('returns to the same finished board with a redacted seed and its results popup dismissed', () => {
		liveGame = { ...liveGame, seed: '' };
		render();
		expect(
			document.querySelector('[data-testid="live-board"]')?.getAttribute('data-dismiss-results'),
		).toBe('false');
		click('Review from results');
		click('End');
		click('← Back to game');
		expect(
			document.querySelector('[data-testid="live-board"]')?.getAttribute('data-dismiss-results'),
		).toBe('true');
		expect(mocks.board).toHaveBeenLastCalledWith(
			expect.objectContaining({ initiallyDismissGameOver: true }),
		);
		expect(button('Review previous game')).toBeUndefined();
		expect(button('Review game')).toBeUndefined();
		expect(button('Review from results')).toBeDefined();
	});

	it.each(['missing', 'partial'] as const)('does not offer review for a %s transcript', (kind) => {
		liveGame = {
			...liveGame,
			reviewTranscript:
				kind === 'missing'
					? undefined
					: { ...transcript, integrity: { status: 'partial' }, deck: null },
		};
		render();
		expect(button('Review game')).toBeUndefined();
		expect(button('Review from results')).toBeUndefined();
		expect(mocks.board).toHaveBeenLastCalledWith(expect.objectContaining({ onReview: undefined }));
		expect(document.body.textContent).not.toContain('Review unavailable');
	});
});
