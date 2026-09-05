// @vitest-environment happy-dom

import { HanabiGameStore } from './HanabiGameStore';
import { SocketContextProvider } from '~/components/SocketContext';
import HanabiGameMessenger from './HanabiGameMessenger';
import { HanabiGameContextProvider } from './HanabiGameContext';
import HanabiDebugPanel from './HanabiDebugPanel';
import {
	HANABI_MAX_CLUES,
	HanabiStage,
	generateHanabiGameData,
	generatePlayer,
} from '@hanabi/shared';
import { act, createElement } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('HanabiDebugPanel discard rule', () => {
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

	function renderPanel(clues: number): void {
		const creatorId = 'creator';
		const debugPlayerId = `debug:${creatorId}`;
		const tile = { id: 'red-1', color: 'red' as const, number: 1 as const };
		const gameData = generateHanabiGameData({
			creatorId,
			stage: HanabiStage.Playing,
			currentPlayerId: debugPlayerId,
			clues,
			players: {
				[creatorId]: generatePlayer({ id: creatorId, name: 'Creator' }),
				[debugPlayerId]: generatePlayer({ id: debugPlayerId, name: 'Debug Player' }),
			},
			tiles: { [tile.id]: tile },
			playerTiles: { [creatorId]: [], [debugPlayerId]: [tile.id] },
		});
		const gameMessenger = {
			debugPlayerAction: vi.fn(),
		} as unknown as HanabiGameMessenger;

		act(() => {
			root.render(
				createElement(
					SocketContextProvider,
					{ value: { userId: creatorId } },
					createElement(
						HanabiGameContextProvider,
						{
							value: {
								code: 'test',
								create: vi.fn(),
								store: new HanabiGameStore(gameData),
								gameMessenger,
								watch: vi.fn(),
							},
						},
						createElement(HanabiDebugPanel),
					),
				),
			);
		});
	}

	it('keeps play enabled and disables discard at eight clues', () => {
		renderPanel(HANABI_MAX_CLUES);

		expect(document.querySelector<HTMLButtonElement>('[aria-label^="Play card"]')?.disabled).toBe(
			false,
		);
		expect(
			document.querySelector<HTMLButtonElement>('[aria-label^="Discard card"]')?.disabled,
		).toBe(true);
	});

	it('enables both actions when a discard can restore a clue', () => {
		renderPanel(HANABI_MAX_CLUES - 1);

		expect(document.querySelector<HTMLButtonElement>('[aria-label^="Play card"]')?.disabled).toBe(
			false,
		);
		expect(
			document.querySelector<HTMLButtonElement>('[aria-label^="Discard card"]')?.disabled,
		).toBe(false);
	});
});
