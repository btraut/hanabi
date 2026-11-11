// @vitest-environment happy-dom
import type { BenchReviewSnapshot, GameTranscriptV1 } from '@hanabi/shared';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fixture from '../games/hanabi/client/dev/review-transcript.json';
import BenchReviewApp from './BenchReviewApp';

function snapshot(turns = 1, id = 'game-1'): BenchReviewSnapshot {
	const transcript = structuredClone(fixture) as GameTranscriptV1;
	transcript.moves = transcript.moves.slice(0, turns);
	transcript.lifecycle.status = 'in_progress';
	transcript.lifecycle.endedAt = null;
	delete transcript.result;
	transcript.rules.allowDragging = false;
	return {
		source: 'local/trial',
		selectedGameId: id,
		games: ['game-1', 'game-2'].map((gameId) => ({
			id: gameId,
			label: gameId,
			status: 'playing',
			score: 0,
			maxScore: 25,
		})),
		game: {
			id,
			label: id,
			status: 'playing',
			score: 0,
			maxScore: 25,
			transcript,
			conventions: '<script>plain text</script>',
			error: null,
			dreamer: null,
			logs: transcript.moves.flatMap((move, index) => [
				{
					playerId: move.actorId,
					opportunity: 'turn' as const,
					turn: index,
					text: `Decision ${index + 1}`,
				},
				{
					playerId: move.actorId,
					opportunity: 'result' as const,
					turn: index + 1,
					text: `Reflection ${index + 1}`,
				},
			]),
		},
	};
}
function response(value: BenchReviewSnapshot): Response {
	return new Response(JSON.stringify(value), { status: 200 });
}
function cursor(): number {
	return Number(document.querySelector('[data-review-cursor]')?.getAttribute('data-review-cursor'));
}
function button(label: string): HTMLButtonElement {
	return [...document.querySelectorAll('button')].find((element) => element.textContent === label)!;
}

describe('local Bench review', () => {
	let root: Root;
	beforeEach(() => {
		(
			globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
		).IS_REACT_ACT_ENVIRONMENT = true;
		vi.useFakeTimers();
		document.body.innerHTML = '<div id="mount"></div>';
		root = createRoot(document.querySelector('#mount')!);
	});
	afterEach(() => {
		act(() => root.unmount());
		vi.useRealTimers();
		vi.unstubAllGlobals();
	});
	async function render() {
		await act(async () => {
			root.render(<BenchReviewApp token="local-secret" />);
			await Promise.resolve();
		});
	}
	async function poll() {
		await act(async () => {
			await vi.advanceTimersByTimeAsync(1000);
		});
	}

	it('polls authenticated live games, follows moves, and pauses follow when scrubbing', async () => {
		let current = snapshot(1);
		const fetcher = vi.fn(() => Promise.resolve(response(current)));
		vi.stubGlobal('fetch', fetcher);
		await render();
		expect(fetcher).toHaveBeenCalledWith(
			'/api/review',
			expect.objectContaining({ headers: { Authorization: 'Bearer local-secret' } }),
		);
		expect(cursor()).toBe(1);
		expect(document.querySelector('[role="alert"]')).toBeNull();
		expect(document.querySelector('[aria-label="Agent reasoning"]')?.textContent).toContain(
			'Decision 1',
		);
		current = snapshot(2);
		await poll();
		expect(cursor()).toBe(2);
		act(() => button('Previous').click());
		expect(cursor()).toBe(1);
		expect(document.querySelector<HTMLInputElement>('input[type="checkbox"]')!.checked).toBe(false);
		current = snapshot(3);
		await poll();
		expect(cursor()).toBe(1);
		const reasoning = document.querySelector('[aria-label="Agent reasoning"]')!.textContent;
		expect(reasoning).toContain('Decision 1');
		expect(reasoning).toContain('Reflection 1');
		expect(reasoning).not.toContain('Decision 2');
		act(() => document.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click());
		expect(cursor()).toBe(3);
		expect(document.querySelector('.bench-document script')).toBeNull();
		expect(document.querySelector('.bench-document')!.textContent).toContain(
			'<script>plain text</script>',
		);
	});

	it('separates pending decisions and never attaches another player’s reflection to a move', async () => {
		const current = snapshot(1);
		const game = current.game!;
		game.logs = game.logs.filter((log) => log.opportunity !== 'result');
		game.logs.push({
			playerId: 'wrong-player',
			opportunity: 'result',
			turn: 1,
			text: 'Wrong reflection',
		});
		game.logs.push({
			playerId: game.transcript.moves[0].postTurn.nextPlayerId!,
			opportunity: 'turn',
			turn: 1,
			text: 'Pending explanation',
		});
		vi.stubGlobal(
			'fetch',
			vi.fn(() => Promise.resolve(response(current))),
		);
		await render();
		const reasoning = document.querySelector('[aria-label="Agent reasoning"]')!.textContent;
		expect(reasoning).toContain('Decision 1');
		expect(reasoning).toContain('No reflection recorded yet.');
		expect(reasoning).not.toContain('Wrong reflection');
		expect(document.querySelector('[aria-label="Pending decision"]')!.textContent).toContain(
			'Pending turn 2',
		);
		act(() => button('Start').click());
		expect(document.querySelector('[aria-label="Pending decision"]')).toBeNull();
	});

	it('aborts obsolete polls and ignores stale responses after pinning another game', async () => {
		let resolveOld!: (response: Response) => void;
		const fetcher = vi.fn<typeof fetch>();
		fetcher.mockResolvedValueOnce(response(snapshot(1)));
		fetcher.mockImplementationOnce(
			() =>
				new Promise((resolve) => {
					resolveOld = resolve;
				}),
		);
		fetcher.mockResolvedValueOnce(response(snapshot(2, 'game-2')));
		vi.stubGlobal('fetch', fetcher);
		await render();
		await poll();
		const oldSignal = fetcher.mock.calls[1][1]!.signal!;
		await act(async () => {
			const select = document.querySelector<HTMLSelectElement>('.bench-game-select select')!;
			select.value = 'game-2';
			select.dispatchEvent(new Event('change', { bubbles: true }));
			await Promise.resolve();
		});
		expect(oldSignal.aborted).toBe(true);
		expect(fetcher.mock.calls[2][0]).toBe('/api/review?game=game-2');
		expect(cursor()).toBe(2);
		await act(async () => {
			resolveOld(response(snapshot(3)));
			await Promise.resolve();
		});
		expect(cursor()).toBe(2);
	});

	it('shows waiting and retry errors, then recovers without losing the selected move', async () => {
		const waiting = snapshot();
		waiting.game = null;
		waiting.selectedGameId = null;
		waiting.games = [];
		const fetcher = vi
			.fn<typeof fetch>()
			.mockResolvedValueOnce(response(waiting))
			.mockRejectedValueOnce(new Error('Connection lost'))
			.mockResolvedValueOnce(response(snapshot()));
		vi.stubGlobal('fetch', fetcher);
		await render();
		expect(document.body.textContent).toContain('Waiting for the first game transcript');
		await poll();
		expect(document.querySelector('[role="alert"]')!.textContent).toBe('Connection lost');
		await poll();
		expect(document.querySelector('[role="alert"]')).toBeNull();
		expect(cursor()).toBe(1);
	});
});
