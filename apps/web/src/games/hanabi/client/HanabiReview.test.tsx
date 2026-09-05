// @vitest-environment happy-dom

import {
	GameTranscriptV1,
	HANABI_DEFAULT_TILE_POSITIONS,
	HANABI_WORKSPACE_ZONE_BOUNDARY,
} from '@hanabi/shared';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, Mock, vi } from 'vitest';
import HanabiReview, { getReviewMoveLabel } from './HanabiReview';
import reviewTranscript from './dev/review-transcript.json';

const transcript = reviewTranscript as GameTranscriptV1;

describe('HanabiReview', () => {
	let root: Root;
	let onExit: Mock<() => void>;

	beforeEach(() => {
		(
			globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
		).IS_REACT_ACT_ENVIRONMENT = true;
		document.body.innerHTML = '<div id="mount"></div>';
		root = createRoot(document.querySelector('#mount')!);
		onExit = vi.fn();
		vi.spyOn(HTMLElement.prototype, 'scrollIntoView').mockImplementation(() => {});
	});

	afterEach(() => {
		act(() => root.unmount());
		vi.restoreAllMocks();
		document.body.innerHTML = '';
	});

	function render(userId = 'alice', data = transcript): void {
		act(() => root.render(<HanabiReview transcript={data} userId={userId} onExit={onExit} />));
	}

	function button(label: string): HTMLButtonElement {
		return [...document.querySelectorAll('button')].find(
			(element) => element.textContent === label,
		)!;
	}

	function click(label: string): void {
		act(() => button(label).click());
	}

	function cursor(): number {
		return Number(
			document.querySelector('[data-review-cursor]')?.getAttribute('data-review-cursor'),
		);
	}

	function cards(playerId: string): HTMLButtonElement[] {
		return [
			...document.querySelectorAll<HTMLButtonElement>(`[data-review-player="${playerId}"] button`),
		];
	}

	function key(key: string, target: EventTarget = window, options: KeyboardEventInit = {}): void {
		act(() => {
			target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...options }));
		});
	}

	it('starts at the initial deal with bounded navigation and no gameplay provider', () => {
		render();
		expect(document.querySelector('[role="alert"]')).toBeNull();
		expect(document.body.textContent).not.toContain('Read-only review');
		expect(cursor()).toBe(0);
		expect(button('Start').disabled).toBe(true);
		expect(button('Previous').disabled).toBe(true);
		expect(button('Next').disabled).toBe(false);
		expect(document.querySelector('[aria-label="Current turn"]')?.textContent).toContain(
			"Ben's turn",
		);
		expect(document.activeElement).toBe(button('← Back to game'));

		click('Next');
		expect(cursor()).toBe(1);
		expect(document.querySelector('.hanabi-review-caption')?.textContent).toBe(
			'Turn 1 · Ben gave Alice a 4 clue',
		);
		click('Previous');
		expect(cursor()).toBe(0);
		click('End');
		expect(cursor()).toBe(transcript.moves.length);
		expect(button('Next').disabled).toBe(true);
		expect(button('End').disabled).toBe(true);
		expect(document.querySelector('[aria-label="Current turn"]')?.textContent).toContain(
			'Game over',
		);
		expect(document.querySelector('.hanabi-review-caption')?.textContent).toContain('Final score');
		click('Start');
		expect(cursor()).toBe(0);
	});

	it('restores both hand zones and each rearrangement without advancing the game turn', () => {
		const data = structuredClone(transcript);
		const tileId = data.dealOrder!.find((hand) => hand.playerId === 'alice')!.tileIds[0];
		data.handMovements = [
			{
				type: 'reposition',
				id: 'drag-one',
				actorId: 'alice',
				createdAt: data.moves[0].createdAt,
				afterMoveIndex: 0,
				positions: { [tileId]: { x: 120, y: HANABI_WORKSPACE_ZONE_BOUNDARY + 10, z: 5 } },
			},
			{
				type: 'reposition',
				id: 'drag-two',
				actorId: 'alice',
				createdAt: data.moves[0].createdAt,
				afterMoveIndex: 0,
				positions: { [tileId]: { ...HANABI_DEFAULT_TILE_POSITIONS[1] } },
			},
		];
		render('alice', data);
		const tile = () => document.querySelector<HTMLButtonElement>(`[data-review-tile="${tileId}"]`)!;
		const initialStyle = tile().getAttribute('style');
		expect(document.querySelectorAll('[data-review-hand-zone="freeform"]')).toHaveLength(
			data.players.length,
		);
		expect(document.querySelector('[aria-label="Game status"]')).not.toBeNull();
		expect(document.querySelector('.hanabi-turn-banner')).not.toBeNull();
		expect(document.querySelector('.hanabi-mobile-game-menu')).toBeNull();
		expect(document.body.textContent).not.toContain('rearranged');
		click('Next');
		expect(tile().style.top).toMatch(/px$/);
		expect(tile().style.zIndex).toBe('5');
		expect(tile().getAttribute('aria-label')).toContain(': hidden');
		expect(document.querySelector('.hanabi-review-caption')?.textContent).toBe(
			'Before turn 1 · Alice rearranged their hand',
		);
		expect(document.querySelector('[aria-label="Current turn"]')?.textContent).toContain(
			"Ben's turn",
		);
		click('Next');
		expect(tile().style.left).toBe('var(--hanabi-player-tile-slot-1)');
		click('Next');
		expect(document.querySelector('.hanabi-review-caption')?.textContent).toBe(
			'Turn 1 · Ben gave Alice a 4 clue',
		);
		click('Previous');
		click('Previous');
		expect(tile().style.zIndex).toBe('5');
		click('Start');
		expect(tile().getAttribute('style')).toBe(initialStyle);
		click('End');
		expect(cursor()).toBe(transcript.moves.length + 2);
	});

	it('jumps to the state after a selected move or slider position', () => {
		render();
		const moveButtons = document.querySelectorAll<HTMLButtonElement>(
			'.hanabi-review-move-list button',
		);
		act(() => moveButtons[2].click());
		expect(cursor()).toBe(2);
		expect(moveButtons[2].getAttribute('aria-current')).toBe('step');
		expect(document.querySelector('.hanabi-review-caption')?.textContent).toContain(
			'Alice discarded yellow 4',
		);

		const slider = document.querySelector<HTMLInputElement>('[aria-label="Review position"]')!;
		act(() => {
			Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(slider, '1');
			slider.dispatchEvent(new Event('input', { bubbles: true }));
		});
		expect(cursor()).toBe(1);
		expect(slider.getAttribute('aria-valuetext')).toContain('1 of 16 steps');
	});

	it('supports bounded keyboard controls without stealing input or modified shortcuts', () => {
		render();
		key('ArrowLeft');
		expect(cursor()).toBe(0);
		key('ArrowRight');
		expect(cursor()).toBe(1);
		key('End');
		key('ArrowRight');
		expect(cursor()).toBe(transcript.moves.length);
		key('Home');
		expect(cursor()).toBe(0);
		key('ArrowRight', document.querySelector('select')!);
		key('End', document.querySelector('input[type="range"]')!);
		key('ArrowRight', window, { ctrlKey: true });
		expect(cursor()).toBe(0);
	});

	it('switches concealed hands without reordering seats or changing the moment', () => {
		render();
		const order = () =>
			[...document.querySelectorAll('[data-review-player]')].map((element) =>
				element.getAttribute('data-review-player'),
			);
		expect(order()).toEqual(transcript.turnOrder);
		expect(
			cards('alice').every((card) => card.getAttribute('aria-label')?.includes(': hidden')),
		).toBe(true);
		expect(cards('ben')[0].getAttribute('aria-label')).toContain(': blue 1');
		expect(cards('alice')[0].outerHTML).not.toContain('yellow');
		click('Next');

		const select = document.querySelector('select')!;
		act(() => {
			select.value = 'player:ben';
			select.dispatchEvent(new Event('change', { bubbles: true }));
		});
		expect(cursor()).toBe(1);
		expect(order()).toEqual(transcript.turnOrder);
		expect(
			cards('ben').every((card) => card.getAttribute('aria-label')?.includes(': hidden')),
		).toBe(true);
		expect(cards('alice')[0].getAttribute('aria-label')).toContain(': yellow 4');

		expect(document.querySelector('input[type="checkbox"]')).toBeNull();
		expect(select.options[0].textContent).toBe('All hands');
		expect(select.children[1].tagName).toBe('HR');
		act(() => {
			select.value = 'all';
			select.dispatchEvent(new Event('change', { bubbles: true }));
		});
		expect(cards('ben')[0].getAttribute('aria-label')).toContain(': blue 1');
		expect(document.body.textContent).toContain('All hands revealed');
		expect(document.querySelector('[aria-label*="viewing as"]')).toBeNull();
		expect(cursor()).toBe(1);
		expect(order()).toEqual(transcript.turnOrder);
		act(() => {
			select.value = 'player:ben';
			select.dispatchEvent(new Event('change', { bubbles: true }));
		});
		expect(cards('ben')[0].getAttribute('aria-label')).toContain(': hidden');
		expect(document.body.textContent).not.toContain('All hands revealed');
	});

	it('does not render future move outcomes, even with every hand revealed', () => {
		render();
		const failedMove = transcript.moves.find((move) => move.type === 'play' && !move.valid)!;
		const failedLabel = getReviewMoveLabel(failedMove, transcript);
		expect(document.body.innerHTML).not.toContain(failedLabel);
		expect(document.body.textContent).not.toContain('failed');
		act(() => {
			const select = document.querySelector('select')!;
			select.value = 'all';
			select.dispatchEvent(new Event('change', { bubbles: true }));
		});
		expect(document.body.innerHTML).not.toContain(failedLabel);
		click('End');
		expect(document.body.textContent).toContain(failedLabel);
		click('Start');
		expect(document.body.innerHTML).not.toContain(failedLabel);
	});

	it('adds clue knowledge at its move and removes it when rewinding', () => {
		render();
		expect(cards('alice')[0].getAttribute('aria-label')).toContain('No clues recorded');
		click('Next');
		expect(cards('alice')[0].getAttribute('aria-label')).toContain('Number clues: 4.');
		act(() => cards('alice')[0].click());
		expect(document.querySelector('.hanabi-review-notes')?.textContent).toBe('Number clues: 4.');
		click('Previous');
		expect(document.querySelector('.hanabi-review-notes')).toBeNull();
		expect(cards('alice')[0].getAttribute('aria-label')).toContain('No clues recorded');
		act(() => cards('alice')[0].click());
		expect(document.querySelector('.hanabi-review-notes')?.textContent).toBe(
			'No clues recorded for this card.',
		);
	});

	it('exits through its callback and defaults visitors to the first seat', () => {
		render('visitor');
		expect(document.querySelector('select')?.value).toBe(`player:${transcript.turnOrder[0]}`);
		click('← Back to game');
		expect(onExit).toHaveBeenCalledOnce();
	});

	it('keeps invalid movement histories inside the unavailable screen', () => {
		const data = structuredClone(transcript);
		data.handMovements = [
			{
				type: 'reposition',
				id: 'invalid',
				actorId: 'alice',
				afterMoveIndex: -1,
				createdAt: data.moves[0].createdAt,
				positions: {},
			},
		];
		render('alice', data);
		expect(document.querySelector('[role="alert"]')?.textContent).toContain('Review unavailable');
		click('← Back to game');
		expect(onExit).toHaveBeenCalledOnce();
	});

	it('shows an unavailable message for incomplete transcripts while retaining the exit', () => {
		render('alice', { ...transcript, integrity: { status: 'partial' }, deck: null });
		expect(document.querySelector('[role="alert"]')?.textContent).toContain('Review unavailable');
		expect(document.querySelector('[aria-label="Review controls"]')).toBeNull();
		click('← Back to game');
		expect(onExit).toHaveBeenCalledOnce();
	});
});
