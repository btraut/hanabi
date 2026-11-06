// @vitest-environment happy-dom

import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HanabiGameActionType, HanabiGameData } from '@hanabi/shared';
import HanabiActivityRail from './HanabiActivityRail';
import { HanabiHighlightContextProvider } from './HanabiHighlightContext';
import { getHanabiDesktopFixtures } from './dev/HanabiDesktopFixtures';

let root: Root;
let gameData: HanabiGameData;
let userId: string;

function render(): void {
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
				<HanabiActivityRail gameData={gameData} userId={userId} composer="Chat input" />
			</HanabiHighlightContextProvider>,
		),
	);
}

beforeEach(() => {
	(
		globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
	).IS_REACT_ACT_ENVIRONMENT = true;
	vi.spyOn(window, 'matchMedia').mockImplementation(
		(query) =>
			({
				matches: true,
				media: query,
				addEventListener: vi.fn(),
				removeEventListener: vi.fn(),
			}) as unknown as MediaQueryList,
	);
	vi.stubGlobal(
		'ResizeObserver',
		class {
			observe = vi.fn();
			disconnect = vi.fn();
		},
	);
	vi.spyOn(HTMLElement.prototype, 'scrollTo').mockImplementation(() => {});
	const fixture = getHanabiDesktopFixtures().standard;
	gameData = { ...fixture.gameData, actions: [] };
	userId = fixture.userId;
	const mount = document.createElement('div');
	mount.className = 'hanabi-responsive-game-surface';
	document.body.append(mount);
	root = createRoot(mount);
});

afterEach(() => {
	act(() => root.unmount());
	document.body.innerHTML = '';
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

describe('compact phone activity footer', () => {
	it('opens the activity drawer and releases the game surface on Escape', () => {
		render();
		const trigger = document.querySelector<HTMLButtonElement>('.hanabi-mobile-chat-trigger')!;
		expect(trigger.textContent).toContain('Waiting for the first action');
		expect(trigger.getAttribute('aria-expanded')).toBe('false');
		act(() => trigger.click());
		expect(trigger.getAttribute('aria-expanded')).toBe('true');
		expect(document.querySelector('.hanabi-mobile-sheet')?.getAttribute('aria-hidden')).toBe(
			'false',
		);
		expect(document.querySelector('.hanabi-responsive-game-surface')?.hasAttribute('inert')).toBe(
			true,
		);
		expect(document.body.style.overflow).toBe('hidden');
		act(() => {
			document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
		});
		expect(trigger.getAttribute('aria-expanded')).toBe('false');
		expect(document.querySelector('.hanabi-responsive-game-surface')?.hasAttribute('inert')).toBe(
			false,
		);
		expect(document.body.style.overflow).toBe('');
	});

	it('keeps the last move visible when chat and clock actions arrive, and clears unread on opening', () => {
		gameData.actions = [
			{
				id: 'discard',
				type: HanabiGameActionType.Discard,
				playerId: gameData.turnOrder[1],
				tile: { id: 'discarded', color: 'red', number: 3 },
			},
		];
		render();
		gameData = {
			...gameData,
			actions: [
				...gameData.actions,
				{
					id: 'clock',
					type: HanabiGameActionType.ShotClockTickedDown,
					remainingTurns: 2,
					playerId: userId,
				},
				{
					id: 'chat',
					type: HanabiGameActionType.Chat,
					playerId: gameData.turnOrder[1],
					message: 'Hello',
				},
			],
		};
		render();
		const trigger = document.querySelector<HTMLButtonElement>('.hanabi-mobile-chat-trigger')!;
		expect(trigger.textContent).toContain('discarded Red 3');
		expect(trigger.textContent).not.toContain('Hello');
		expect(trigger.getAttribute('aria-label')).toContain('1 unread chat messages');
		act(() => trigger.click());
		expect(document.querySelector('.hanabi-mobile-chat-badge')).toBeNull();
		expect(document.querySelector('.hanabi-mobile-sheet')?.textContent).toContain('Hello');
	});
});
