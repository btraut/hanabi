// @vitest-environment happy-dom

import { generateHanabiGameData, HanabiGameData, HanabiStage } from '@hanabi/shared';
import { act, useSyncExternalStore } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import HanabiLivePlayerWorkspace from './HanabiLivePlayerWorkspace';
import { HanabiDesktopPlayerWorkspaces } from './HanabiPlayerWorkspace';

let gameData: HanabiGameData;
const subscribers = new Set<() => void>();
const subscribe = (callback: () => void) => {
	subscribers.add(callback);
	return () => subscribers.delete(callback);
};
const getSnapshot = () => gameData;

vi.mock('~/games/hanabi/client/HanabiGameContext', () => ({
	useBotStatusData: () => useSyncExternalStore(subscribe, getSnapshot),
}));

describe('HanabiLivePlayerWorkspace', () => {
	let root: Root;
	const tileRender = vi.fn();
	function TileSurface({ playerId }: { playerId: string }) {
		tileRender(playerId);
		return <div data-tile-surface={playerId}>Hand</div>;
	}
	beforeEach(() => {
		(
			globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
		).IS_REACT_ACT_ENVIRONMENT = true;
		document.body.innerHTML = '<div id="mount"></div>';
		root = createRoot(document.querySelector('#mount')!);
		gameData = generateHanabiGameData({
			stage: HanabiStage.Playing,
			currentPlayerId: 'bot-1',
			players: {
				alice: { id: 'alice', name: 'Alice', connected: true },
				'bot-1': { id: 'bot-1', name: 'Ember', connected: false, kind: 'bot' },
			},
			turnOrder: ['alice', 'bot-1'],
			bots: {
				available: true,
				canManage: false,
				turn: { playerId: 'bot-1', status: 'thinking', canRetry: false },
			},
		});
		tileRender.mockClear();
	});
	afterEach(() => {
		act(() => root.unmount());
		expect(subscribers.size).toBe(0);
		document.body.innerHTML = '';
	});

	function render() {
		act(() =>
			root.render(
				<HanabiDesktopPlayerWorkspaces
					gameData={{ ...gameData, bots: undefined }}
					userId="alice"
					workspaceComponent={HanabiLivePlayerWorkspace}
					renderTileSurface={(playerId) => <TileSurface playerId={playerId} />}
				/>,
			),
		);
	}

	function publish(next: HanabiGameData) {
		act(() => {
			gameData = next;
			for (const callback of subscribers) callback();
		});
	}

	it('updates thinking status without rerendering the unchanged tile surfaces', () => {
		render();
		const tileSurfaces = [...document.querySelectorAll('[data-tile-surface]')];
		expect(tileRender).toHaveBeenCalledTimes(2);
		expect(document.querySelectorAll('.hanabi-avatar-orbit')).toHaveLength(1);
		publish({
			...gameData,
			bots: { ...gameData.bots!, turn: { ...gameData.bots!.turn!, status: 'error' } },
		});
		expect(document.querySelector('.hanabi-avatar-orbit')).toBeNull();
		expect(tileRender).toHaveBeenCalledTimes(2);
		expect([...document.querySelectorAll('[data-tile-surface]')]).toEqual(tileSurfaces);
	});

	it('reads authoritative turn and clue status while tile presentation retains an earlier turn', () => {
		render();
		publish({
			...gameData,
			currentPlayerId: 'alice',
			bots: { ...gameData.bots!, turn: { ...gameData.bots!.turn!, opportunity: 'clue' } },
		});
		expect(document.querySelector('[aria-label="Alice, you, playing"]')).not.toBeNull();
		expect(document.querySelector('[aria-label="Ember, bot, thinking"]')).not.toBeNull();
		expect(document.body.textContent).toContain('Considering clue…');
		expect(tileRender).toHaveBeenCalledTimes(2);
	});
});
