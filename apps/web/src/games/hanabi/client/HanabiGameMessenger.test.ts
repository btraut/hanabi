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
	};
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
