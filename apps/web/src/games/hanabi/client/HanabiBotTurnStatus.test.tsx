// @vitest-environment happy-dom

import { generateHanabiGameData, HanabiGameData, HanabiStage } from '@hanabi/shared';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import HanabiBotTurnStatus from './HanabiBotTurnStatus';

let gameData: HanabiGameData;
let userId: string | null;
const messenger = { retryBotTurn: vi.fn<() => Promise<void>>() };

vi.mock('~/components/SocketContext', () => ({ useUserId: () => userId }));
vi.mock('~/games/hanabi/client/HanabiGameContext', () => ({
	useBotStatusData: () => gameData,
	useGameMessenger: () => messenger,
}));

async function settleAction(action: () => void) {
	await act(async () => {
		action();
		await Promise.resolve();
	});
}

describe('HanabiBotTurnStatus', () => {
	let root: Root;
	beforeEach(() => {
		(
			globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
		).IS_REACT_ACT_ENVIRONMENT = true;
		document.body.innerHTML = '<div id="mount"></div>';
		root = createRoot(document.querySelector('#mount')!);
		userId = 'alice';
		gameData = generateHanabiGameData({
			stage: HanabiStage.Playing,
			currentPlayerId: 'bot-1',
			players: {
				alice: { id: 'alice', name: 'Alice', connected: true },
				'bot-1': { id: 'bot-1', name: 'Ember', connected: false, kind: 'bot' },
			},
			bots: {
				available: true,
				canManage: false,
				turn: { playerId: 'bot-1', status: 'error', canRetry: true },
			},
		});
		messenger.retryBotTurn.mockReset().mockResolvedValue();
	});
	afterEach(() => {
		act(() => root.unmount());
		document.body.innerHTML = '';
	});
	function render() {
		act(() => root.render(<HanabiBotTurnStatus />));
	}

	it('shows the failure and lets a seated human retry once', async () => {
		let finish!: () => void;
		messenger.retryBotTurn.mockReturnValue(
			new Promise<void>((resolve) => {
				finish = resolve;
			}),
		);
		gameData.bots!.turn!.message = 'The bot timed out. Try again.';
		render();
		expect(document.body.textContent).toContain('Ember is paused');
		expect(document.body.textContent).toContain('The bot timed out. Try again.');
		const retry = document.querySelector('button')!;
		act(() => {
			retry.click();
			retry.click();
		});
		expect(messenger.retryBotTurn).toHaveBeenCalledOnce();
		expect(retry.disabled).toBe(true);
		expect(retry.textContent).toBe('Retrying…');
		await settleAction(() => finish());
		expect(retry.disabled).toBe(false);
	});

	it.each(['spectator', 'not-joined', 'bot', 'not-retryable'])(
		'does not offer retry for %s',
		(viewer) => {
			if (viewer === 'spectator') userId = 'spectator';
			if (viewer === 'not-joined') userId = null;
			if (viewer === 'bot') userId = 'bot-1';
			if (viewer === 'not-retryable') gameData.bots!.turn!.canRetry = false;
			render();
			expect(document.body.textContent).toContain('Ember is paused');
			expect(document.querySelector('button')).toBeNull();
		},
	);

	it.each(['disabled', 'exhausted'] as const)(
		'explains recovery for %s without retry',
		(status) => {
			gameData.bots!.turn!.status = status;
			if (status === 'exhausted') gameData.bots!.turn!.canRetry = false;
			render();
			expect(document.body.textContent).toContain(
				status === 'disabled' ? 'Ask the server operator' : 'Reset the game',
			);
			expect(document.querySelector('button')).toBeNull();
		},
	);

	it('offers retry when the server restores allowance for an exhausted round', async () => {
		gameData.bots!.turn!.status = 'exhausted';
		gameData.bots!.turn!.canRetry = false;
		render();
		expect(document.querySelector('button')).toBeNull();
		expect(messenger.retryBotTurn).not.toHaveBeenCalled();

		gameData.bots!.turn!.canRetry = true;
		render();
		const retry = document.querySelector('button')!;
		expect(retry.textContent).toBe('Retry');
		await settleAction(() => retry.click());
		expect(messenger.retryBotTurn).toHaveBeenCalledOnce();
	});

	it('hides stale failure status when reconnect receives a thinking, advanced, or finished turn', () => {
		render();
		expect(document.querySelector('section')).not.toBeNull();
		gameData.bots!.turn!.status = 'thinking';
		render();
		expect(document.querySelector('section')).toBeNull();
		gameData.bots!.turn!.status = 'error';
		gameData.currentPlayerId = 'alice';
		render();
		expect(document.querySelector('section')).toBeNull();
		gameData.currentPlayerId = 'bot-1';
		gameData.stage = HanabiStage.Finished;
		render();
		expect(document.querySelector('section')).toBeNull();
	});

	it('shows a rejected retry without losing the recovery control', async () => {
		messenger.retryBotTurn.mockRejectedValue(new Error('Please wait before retrying.'));
		render();
		await settleAction(() => document.querySelector('button')!.click());
		expect(document.querySelector('[role="alert"]')?.textContent).toBe(
			'Please wait before retrying.',
		);
		expect(document.querySelector('button')?.disabled).toBe(false);
	});

	it('lets a seated human retry an off-turn clue response without blocking play', async () => {
		gameData.currentPlayerId = 'alice';
		gameData.bots!.turn!.opportunity = 'clue';
		render();
		expect(document.querySelector('section')?.getAttribute('aria-label')).toBe(
			'Bot clue response paused',
		);
		expect(document.body.textContent).toContain('Ember is paused');
		expect(document.body.textContent).toContain('considering the clue. Play can continue.');
		await settleAction(() => document.querySelector('button')!.click());
		expect(messenger.retryBotTurn).toHaveBeenCalledOnce();
		expect(gameData.currentPlayerId).toBe('alice');
		gameData.bots!.turn!.status = 'thinking';
		render();
		expect(document.querySelector('section')).toBeNull();
	});

	it.each(['opportunity', 'player', 'status'] as const)(
		'resets a retry failure when the bot %s changes',
		async (changed) => {
			messenger.retryBotTurn.mockRejectedValue(new Error('The earlier retry failed.'));
			render();
			await settleAction(() => document.querySelector('button')!.click());
			expect(document.querySelector('[role="alert"]')?.textContent).toContain('earlier retry');

			if (changed === 'opportunity') {
				gameData.bots!.turn!.opportunity = 'clue';
			} else if (changed === 'player') {
				gameData.players = {
					...gameData.players,
					'bot-2': { id: 'bot-2', name: 'Ash', connected: false, kind: 'bot' },
				};
				gameData.currentPlayerId = 'bot-2';
				gameData.bots!.turn!.playerId = 'bot-2';
			} else {
				gameData.bots!.turn!.status = 'thinking';
				render();
				gameData.bots!.turn!.status = 'error';
			}
			render();

			expect(document.querySelector('[role="alert"]')).toBeNull();
			expect(document.querySelector('button')?.textContent).toBe('Retry');
		},
	);

	it('does not carry a pending retry into a new clue opportunity', async () => {
		let reject!: (error: Error) => void;
		messenger.retryBotTurn.mockReturnValue(
			new Promise<void>((_resolve, fail) => {
				reject = fail;
			}),
		);
		render();
		act(() => document.querySelector('button')!.click());
		expect(document.querySelector('button')?.disabled).toBe(true);

		gameData.bots!.turn!.opportunity = 'clue';
		render();
		expect(document.querySelector('button')?.disabled).toBe(false);
		await settleAction(() => reject(new Error('The earlier retry failed.')));
		expect(document.querySelector('[role="alert"]')).toBeNull();
		expect(document.querySelector('button')?.textContent).toBe('Retry');
	});
});
