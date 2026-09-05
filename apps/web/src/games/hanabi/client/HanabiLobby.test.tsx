// @vitest-environment happy-dom

import { generateHanabiGameData, HanabiGameData, HanabiStage } from '@hanabi/shared';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import HanabiLobby from './HanabiLobby';

let gameData: HanabiGameData;
let userId: string | null;
const messenger = {
	addBot: vi.fn<() => Promise<void>>(),
	removeBot: vi.fn<(playerId: string) => Promise<void>>(),
	leave: vi.fn(),
	start: vi.fn(),
};

vi.mock('~/components/SocketContext', () => ({ useUserId: () => userId }));
vi.mock('~/games/hanabi/client/HanabiGameContext', () => ({
	useGameData: () => gameData,
	useGameMessenger: () => messenger,
	useHanabiGameContext: () => ({ code: 'ABCD' }),
}));
vi.mock('~/games/hanabi/client/HanabiHeader', () => ({ default: () => null }));
vi.mock('~/games/hanabi/client/HanabiChooseRuleSetForm', () => ({ default: () => null }));
vi.mock('~/games/hanabi/client/HanabiLobbyGameOptionsForm', () => ({ default: () => null }));
vi.mock('~/games/hanabi/client/HanabiCopyLinkButton', () => ({ default: () => null }));
vi.mock('~/games/hanabi/client/HanabiJoinForm', () => ({ default: () => <p>Join game</p> }));

const human = { id: 'alice', name: 'Alice', connected: true };
const bot = { id: 'bot-1', name: 'Ember', connected: false, kind: 'bot' as const };

async function settleAction(action: () => void) {
	await act(async () => {
		action();
		await Promise.resolve();
	});
}

describe('HanabiLobby bot controls', () => {
	let root: Root;

	beforeEach(() => {
		(
			globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
		).IS_REACT_ACT_ENVIRONMENT = true;
		document.body.innerHTML = '<div id="mount"></div>';
		root = createRoot(document.querySelector('#mount')!);
		userId = 'alice';
		gameData = generateHanabiGameData({
			stage: HanabiStage.Setup,
			players: { alice: human, [bot.id]: bot },
			bots: { available: true, canManage: true, turn: null },
		});
		vi.resetAllMocks();
		messenger.addBot.mockResolvedValue();
		messenger.removeBot.mockResolvedValue();
	});

	afterEach(() => {
		act(() => root.unmount());
		document.body.innerHTML = '';
	});

	function render() {
		act(() => root.render(<HanabiLobby />));
	}
	function button(label: string) {
		return [...document.querySelectorAll('button')].find(
			(element) => element.textContent === label,
		);
	}

	it('lets the joined creator add and remove bot seats', async () => {
		render();
		expect(button('Add bot')?.disabled).toBe(false);
		expect(document.body.textContent).toContain('EmberBot');
		expect(document.querySelector('[aria-label="Players"] .opacity-60')).toBeNull();
		await settleAction(() => button('Add bot')!.click());
		expect(messenger.addBot).toHaveBeenCalledOnce();
		await settleAction(() =>
			document.querySelector<HTMLButtonElement>('[aria-label="Remove Ember"]')!.click(),
		);
		expect(messenger.removeBot).toHaveBeenCalledWith('bot-1');
	});

	it.each(['other-player', 'spectator', 'not-joined', 'mid-game', 'bot'])(
		'hides management from %s',
		(viewer) => {
			if (viewer === 'other-player') gameData.bots!.canManage = false;
			if (viewer === 'spectator') userId = 'spectator';
			if (viewer === 'not-joined') userId = null;
			if (viewer === 'mid-game') gameData.stage = HanabiStage.Playing;
			if (viewer === 'bot') userId = bot.id;
			render();
			expect(button('Add bot')).toBeUndefined();
			expect(document.querySelector('[aria-label="Remove Ember"]')).toBeNull();
		},
	);

	it('disables Add bot at capacity but still permits removal', () => {
		for (let index = 2; index <= 4; index++) {
			gameData.players = {
				...gameData.players,
				[`bot-${index}`]: { ...bot, id: `bot-${index}`, name: `Bot ${index}` },
			};
		}
		render();
		expect(button('Add bot')?.disabled).toBe(true);
		expect(document.body.textContent).toContain('The lobby is full (5 players).');
		expect(document.querySelector<HTMLButtonElement>('[aria-label="Remove Ember"]')!.disabled).toBe(
			false,
		);
	});

	it('explains unavailable bots without preventing removal', () => {
		gameData.bots!.available = false;
		render();
		expect(button('Add bot')?.disabled).toBe(true);
		expect(document.body.textContent).toContain('Bots are unavailable on this server.');
		expect(document.querySelector<HTMLButtonElement>('[aria-label="Remove Ember"]')!.disabled).toBe(
			false,
		);
	});

	it('blocks duplicate clicks and locks the roster while awaiting the server', async () => {
		let finish!: () => void;
		messenger.addBot.mockReturnValue(
			new Promise<void>((resolve) => {
				finish = resolve;
			}),
		);
		render();
		const addButton = button('Add bot')!;
		act(() => {
			addButton.click();
			addButton.click();
		});
		expect(messenger.addBot).toHaveBeenCalledOnce();
		expect(button('Adding…')?.disabled).toBe(true);
		expect(button('Start game')?.disabled).toBe(true);
		expect(document.querySelector<HTMLButtonElement>('[aria-label="Remove Ember"]')!.disabled).toBe(
			true,
		);
		await settleAction(() => finish());
		expect(button('Add bot')?.disabled).toBe(false);
	});

	it('shows add and removal errors inline and unlocks controls', async () => {
		messenger.addBot.mockRejectedValue(new Error('The lobby is full.'));
		messenger.removeBot.mockRejectedValue(new Error('Only the creator can remove bots.'));
		render();
		await settleAction(() => button('Add bot')!.click());
		expect(document.querySelector('[role="alert"]')?.textContent).toBe('The lobby is full.');
		expect(button('Add bot')?.disabled).toBe(false);
		await settleAction(() =>
			document.querySelector<HTMLButtonElement>('[aria-label="Remove Ember"]')!.click(),
		);
		expect(document.querySelector('[role="alert"]')?.textContent).toBe(
			'Only the creator can remove bots.',
		);
	});
});
