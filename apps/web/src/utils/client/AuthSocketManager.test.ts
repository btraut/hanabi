import {
	AuthenticateSocketResponseMessage,
	AuthSocketManagerMessage,
	PubSub,
	SOCKET_MANAGER_SCOPE,
} from '@hanabi/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Ajax from './Ajax';
import AuthSocketManager, { AuthenticationState } from './AuthSocketManager';
import SocketManager, { ConnectionState } from './SocketManager';

function authenticationResponse(userId: string): AuthenticateSocketResponseMessage {
	return {
		scope: SOCKET_MANAGER_SCOPE,
		type: 'AuthenticateSocketResponseMessage',
		data: { userId },
	};
}

function createSocketManager() {
	const socketManager = {
		connectionState: ConnectionState.Connected,
		onConnect: new PubSub<void>(),
		onDisconnect: new PubSub<void>(),
		send: vi.fn(),
		expectMessageOfType: vi.fn(),
	};

	return {
		fake: socketManager,
		manager: socketManager as unknown as SocketManager<AuthSocketManagerMessage>,
	};
}

describe('AuthSocketManager', () => {
	beforeEach(() => {
		vi.spyOn(console, 'log').mockImplementation(() => undefined);
		vi.spyOn(console, 'error').mockImplementation(() => undefined);
		vi.spyOn(Ajax, 'get').mockResolvedValue({ token: 'token' });
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('shares one authentication operation between concurrent callers', async () => {
		const { fake, manager } = createSocketManager();
		fake.expectMessageOfType.mockResolvedValue(authenticationResponse('user-1'));
		const auth = new AuthSocketManager(manager);

		const first = auth.authenticate();
		const second = auth.authenticate();

		expect(second).toBe(first);
		await expect(first).resolves.toBeUndefined();
		expect(fake.send).toHaveBeenCalledTimes(1);
		expect(auth.authenticationState).toBe(AuthenticationState.Authenticated);
		expect(auth.userId).toBe('user-1');
	});

	it('handles a reconnect failure and retries on a later reconnect', async () => {
		const { fake, manager } = createSocketManager();
		fake.expectMessageOfType
			.mockResolvedValueOnce(authenticationResponse('user-1'))
			.mockRejectedValueOnce(new Error('temporary failure'))
			.mockResolvedValueOnce(authenticationResponse('user-1'));
		const auth = new AuthSocketManager(manager);

		await auth.authenticate();
		fake.onDisconnect.emit();
		fake.onConnect.emit();

		await vi.waitFor(() => {
			expect(auth.authenticationState).toBe(AuthenticationState.Unauthenticated);
			expect(console.error).toHaveBeenCalledTimes(1);
		});

		fake.onDisconnect.emit();
		fake.onConnect.emit();

		await vi.waitFor(() => {
			expect(auth.authenticationState).toBe(AuthenticationState.Authenticated);
			expect(auth.userId).toBe('user-1');
		});
		expect(fake.expectMessageOfType).toHaveBeenCalledTimes(3);
	});
});
