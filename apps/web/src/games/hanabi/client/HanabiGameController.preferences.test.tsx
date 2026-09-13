// @vitest-environment happy-dom

import { generateHanabiGameData, HanabiGameData } from '@hanabi/shared';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import HanabiGameController from './HanabiGameController';
import { HanabiGameContext, useHanabiGameContext } from './HanabiGameContext';
import type { HanabiLobbySettings } from './HanabiLobbySettings';
import LOCAL_STORAGE_KEYS from './HanabiLocalStorageManager';

const mocks = vi.hoisted(() => ({
	create: vi.fn().mockResolvedValue({ id: 'new-game', code: 'new' }),
	watch: vi.fn().mockResolvedValue({ id: 'existing-game', code: 'existing' }),
	connect: vi.fn().mockResolvedValue(undefined),
	authenticate: vi.fn().mockResolvedValue(undefined),
	initialSettings: [] as (HanabiLobbySettings | undefined)[],
}));
vi.mock('~/components/SocketContext', () => ({
	useSocket: () => ({
		socketManager: { connect: mocks.connect },
		authSocketManager: { authenticate: mocks.authenticate },
	}),
}));
vi.mock('~/games/client/GameManagerContext', () => ({
	useGameManager: () => ({ create: mocks.create, watch: mocks.watch }),
}));
vi.mock('./HanabiGameMessenger', () => ({
	default: class {
		private receive: (game: HanabiGameData) => void;
		constructor(
			_id: string,
			_socket: unknown,
			_auth: unknown,
			receive: (game: HanabiGameData) => void,
			settings?: HanabiLobbySettings,
		) {
			mocks.initialSettings.push(settings);
			this.receive = receive;
		}
		refreshGameData() {
			this.receive(generateHanabiGameData());
			return Promise.resolve();
		}
		cleanUp() {}
	},
}));

const settings: HanabiLobbySettings = {
	ruleSet: 'rainbow-black-powder',
	criticalGameOver: false,
	allowDragging: true,
	showNotes: false,
};

describe('controller preference isolation', () => {
	let root: Root;
	let context: HanabiGameContext;
	function Probe() {
		context = useHanabiGameContext();
		return null;
	}
	beforeEach(() => {
		(
			globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
		).IS_REACT_ACT_ENVIRONMENT = true;
		mocks.initialSettings.length = 0;
		localStorage.clear();
		localStorage.setItem(LOCAL_STORAGE_KEYS.LOBBY_SETTINGS, JSON.stringify(settings));
		document.body.innerHTML = '<div id="mount"></div>';
		root = createRoot(document.querySelector('#mount')!);
		act(() =>
			root.render(
				<HanabiGameController>
					<Probe />
				</HanabiGameController>,
			),
		);
	});
	afterEach(() => {
		act(() => root.unmount());
		document.body.innerHTML = '';
	});

	it('loads saved settings into each newly created game', async () => {
		await act(async () => {
			expect(await context.create()).toBe('new');
		});
		expect(mocks.initialSettings).toEqual([settings]);
		expect(context!.code).toBe('new');
		expect(context!.store.game.getSnapshot()).not.toBeNull();
		const updated = { ...settings, ruleSet: '5-color' };
		localStorage.setItem(LOCAL_STORAGE_KEYS.LOBBY_SETTINGS, JSON.stringify(updated));
		await act(async () => {
			await context.create();
		});
		expect(mocks.initialSettings).toEqual([settings, updated]);
	});

	it('never sends local defaults when opening an existing game', async () => {
		await act(async () => {
			await context.watch('existing');
		});
		expect(mocks.initialSettings).toEqual([undefined]);
		expect(context!.code).toBe('existing');
	});
});
