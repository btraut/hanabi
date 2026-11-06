import { HanabiMessage } from '@hanabi/shared';
import { describe, expect, it, vi } from 'vitest';
import AuthSocketManager, { AuthenticationState } from '~/utils/client/AuthSocketManager';
import SocketManager, { ConnectionState } from '~/utils/client/SocketManager';
import HanabiGameMessenger from './HanabiGameMessenger';
import type { HanabiLobbySettings } from './HanabiLobbySettings';

const settings: HanabiLobbySettings = {
	ruleSet: 'black-powder',
	criticalGameOver: false,
	allowDragging: true,
	showNotes: false,
};

function fixture(initialSettings?: HanabiLobbySettings) {
	const event = () => ({ subscribe: vi.fn(() => 1), unsubscribe: vi.fn() });
	const socket = {
		onConnect: event(),
		onDisconnect: event(),
		onMessage: event(),
		connectionState: ConnectionState.Connected,
		send: vi.fn<(message: HanabiMessage) => void>(),
		expectMessageOfType: vi.fn().mockResolvedValue({ data: {} }),
		expect: vi
			.fn<
				(
					matches: (message: HanabiMessage) => boolean,
					timeout?: number,
				) => Promise<{ data: { error?: string; requestId?: string } }>
			>()
			.mockResolvedValue({ data: {} }),
	};
	socket.expect.mockImplementation(() => {
		const message = socket.send.mock.calls.at(-1)?.[0];
		return Promise.resolve({
			data: {
				requestId:
					message?.type === 'ChangeBotConventionsMessage' ? message.data.requestId : undefined,
			},
		});
	});
	const auth = {
		onAuthenticate: event(),
		authenticationState: AuthenticationState.Authenticated,
	};
	const messenger = new HanabiGameMessenger(
		'game-id',
		socket as unknown as SocketManager<HanabiMessage>,
		auth as unknown as AuthSocketManager,
		vi.fn(),
		initialSettings,
	);
	return { messenger, socket };
}

describe('new game preferences', () => {
	it('applies remembered settings only after successful join and only once', async () => {
		const { messenger, socket } = fixture(settings);
		expect(socket.send).not.toHaveBeenCalled();
		await messenger.join('Alice');
		expect(socket.send.mock.calls.map(([message]) => message.type)).toEqual([
			'AddPlayerMessage',
			'ChangeGameSettingsMessage',
		]);
		expect(socket.send).toHaveBeenLastCalledWith(
			expect.objectContaining({ type: 'ChangeGameSettingsMessage', data: settings }),
		);
		await messenger.join('Alice');
		expect(
			socket.send.mock.calls.filter(([message]) => message.type === 'ChangeGameSettingsMessage'),
		).toHaveLength(1);
	});

	it('does not apply preferences to existing games', async () => {
		const { messenger, socket } = fixture();
		await messenger.join('Alice');
		expect(socket.send).toHaveBeenCalledOnce();
		expect(socket.send).toHaveBeenCalledWith(expect.objectContaining({ type: 'AddPlayerMessage' }));
	});

	it('retains preferences through a failed join without sending a settings change', async () => {
		const { messenger, socket } = fixture(settings);
		socket.expectMessageOfType.mockResolvedValueOnce({ data: { error: 'The lobby is full.' } });
		await expect(messenger.join('Alice')).rejects.toThrow('The lobby is full.');
		expect(socket.send).toHaveBeenCalledOnce();
		await messenger.join('Alice');
		expect(socket.send).toHaveBeenLastCalledWith(
			expect.objectContaining({ type: 'ChangeGameSettingsMessage', data: settings }),
		);
	});
});

describe('bot conventions commands', () => {
	it.each(['Save critical tiles.', null])(
		'sends %s with the revision and allows time for review',
		async (text) => {
			const { messenger, socket } = fixture();
			await messenger.changeBotConventions(text, 3);
			expect(socket.send).toHaveBeenCalledExactlyOnceWith({
				type: 'ChangeBotConventionsMessage',
				scope: 'game.hanabi.game-id',
				data: { text, revision: 3, requestId: expect.any(String) as string },
			});
			const message = socket.send.mock.calls[0][0];
			if (message.type !== 'ChangeBotConventionsMessage') throw new Error('Unexpected message.');
			const { requestId } = message.data;
			expect(socket.expect).toHaveBeenCalledWith(expect.any(Function), 45_000);
			const matches = socket.expect.mock.calls[0][0];
			expect(
				matches({
					type: 'ChangeBotConventionsResponseMessage',
					scope: 'game.hanabi.game-id',
					data: { requestId },
				}),
			).toBe(true);
			expect(
				matches({
					type: 'ChangeBotConventionsResponseMessage',
					scope: 'game.hanabi.other',
					data: { requestId },
				}),
			).toBe(false);
			expect(
				matches({
					type: 'ChangeBotConventionsResponseMessage',
					scope: 'game.hanabi.game-id',
					data: { requestId: 'another-tab-request', error: 'Another request failed.' },
				}),
			).toBe(false);
		},
	);

	it('correlates each command independently even in the same room', async () => {
		const { messenger, socket } = fixture();
		await messenger.changeBotConventions('First convention.', 0);
		await messenger.changeBotConventions('Second convention.', 1);
		const first = socket.send.mock.calls[0][0];
		const second = socket.send.mock.calls[1][0];
		if (
			first.type !== 'ChangeBotConventionsMessage' ||
			second.type !== 'ChangeBotConventionsMessage'
		)
			throw new Error('Unexpected message.');
		expect(first.data.requestId).not.toBe(second.data.requestId);
		const firstResponse: HanabiMessage = {
			type: 'ChangeBotConventionsResponseMessage',
			scope: first.scope,
			data: { requestId: first.data.requestId },
		};
		expect(socket.expect.mock.calls[0][0](firstResponse)).toBe(true);
		expect(socket.expect.mock.calls[1][0](firstResponse)).toBe(false);
	});

	it('propagates rejection and transport failure to the editor', async () => {
		const { messenger, socket } = fixture();
		socket.expect.mockResolvedValueOnce({ data: { error: 'The saved conventions changed.' } });
		await expect(messenger.changeBotConventions('My draft.', 0)).rejects.toThrow(
			'The saved conventions changed.',
		);
		socket.expect.mockRejectedValueOnce(new Error('Server disconnected.'));
		await expect(messenger.changeBotConventions('My draft.', 0)).rejects.toThrow(
			'Server disconnected.',
		);
	});

	it('does not leave a response waiter when sending fails', async () => {
		const { messenger, socket } = fixture();
		socket.send.mockImplementationOnce(() => {
			throw new Error('Socket closed.');
		});
		await expect(messenger.changeBotConventions('My draft.', 0)).rejects.toThrow('Socket closed.');
		expect(socket.expect).not.toHaveBeenCalled();
	});
});
