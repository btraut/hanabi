// @vitest-environment happy-dom

import { generateHanabiGameData, HanabiStage } from '@hanabi/shared';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import LOCAL_STORAGE_KEYS from './HanabiLocalStorageManager';
import {
	HanabiLobbySettings,
	readHanabiLobbySettings,
	useRememberHanabiLobbySettings,
} from './HanabiLobbySettings';

const settings: HanabiLobbySettings = {
	ruleSet: 'rainbow-black-powder',
	criticalGameOver: false,
	allowDragging: false,
	showNotes: true,
};

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe('saved lobby settings', () => {
	it('reads all settings and excludes unrelated stored fields', () => {
		localStorage.setItem(
			LOCAL_STORAGE_KEYS.LOBBY_SETTINGS,
			JSON.stringify({ ...settings, players: { private: 'data' } }),
		);
		expect(readHanabiLobbySettings()).toEqual(settings);
	});

	it.each([
		undefined,
		'not json',
		'null',
		'[]',
		'false',
		JSON.stringify({ ...settings, ruleSet: 'unknown' }),
		JSON.stringify({ ...settings, criticalGameOver: 'false' }),
		JSON.stringify({ ...settings, allowDragging: 0 }),
		JSON.stringify({ ...settings, showNotes: null }),
		JSON.stringify({ ruleSet: 'rainbow' }),
	])('ignores missing or invalid settings: %s', (value) => {
		if (value !== undefined) localStorage.setItem(LOCAL_STORAGE_KEYS.LOBBY_SETTINGS, value);
		expect(readHanabiLobbySettings()).toBeUndefined();
	});

	it('handles unavailable storage', () => {
		vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
			throw new Error('storage disabled');
		});
		expect(readHanabiLobbySettings()).toBeUndefined();
	});
});

describe('remembering shared lobby settings', () => {
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

	function Listener({
		values,
		joined = true,
		stage = HanabiStage.Setup,
	}: {
		values: HanabiLobbySettings;
		joined?: boolean;
		stage?: HanabiStage;
	}) {
		useRememberHanabiLobbySettings(generateHanabiGameData({ ...values, stage }), joined);
		return null;
	}

	it('remembers the joined lobby and later settings received from another player', () => {
		act(() => root.render(<Listener values={settings} />));
		expect(readHanabiLobbySettings()).toEqual(settings);
		const updated: HanabiLobbySettings = { ...settings, ruleSet: '6-color', showNotes: false };
		act(() => root.render(<Listener values={updated} />));
		expect(readHanabiLobbySettings()).toEqual(updated);
	});

	it('does not replace preferences for spectators or active games', () => {
		localStorage.setItem(LOCAL_STORAGE_KEYS.LOBBY_SETTINGS, JSON.stringify(settings));
		const other = { ...settings, showNotes: false };
		act(() => root.render(<Listener values={other} joined={false} />));
		expect(readHanabiLobbySettings()).toEqual(settings);
		act(() => root.render(<Listener values={other} stage={HanabiStage.Playing} />));
		expect(readHanabiLobbySettings()).toEqual(settings);
	});

	it('keeps rendering when storage writes fail', () => {
		vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
			throw new Error('quota exceeded');
		});
		expect(() => act(() => root.render(<Listener values={settings} />))).not.toThrow();
	});
});
