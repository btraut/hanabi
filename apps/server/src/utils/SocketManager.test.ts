import {
	AuthenticateSocketResponseMessage,
	SOCKET_MANAGER_SCOPE,
	SocketMessageBase,
} from '@hanabi/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createServer, Server as HTTPServer } from 'node:http';
import { AddressInfo } from 'node:net';
import { io, Socket } from 'socket.io-client';
import SocketManager from './SocketManager.js';
import Logger from './Logger.js';

const sockets: Socket[] = [];
const servers: HTTPServer[] = [];
const managers: SocketManager[] = [];

const eventLog = vi.fn<typeof Logger.event>();

beforeEach(() => {
	eventLog.mockReset();
	vi.spyOn(Logger, 'event').mockImplementation(eventLog);
});

async function createSocketManager() {
	const httpServer = createServer();
	servers.push(httpServer);
	const manager = new SocketManager(httpServer);
	managers.push(manager);
	manager.start();
	await new Promise<void>((resolve) => httpServer.listen(0, '127.0.0.1', resolve));
	const address = httpServer.address() as AddressInfo;
	return { manager, url: `http://127.0.0.1:${address.port}` };
}

function connect(url: string): Promise<Socket> {
	return new Promise((resolve, reject) => {
		const socket = io(url, {
			forceNew: true,
			reconnection: false,
			transports: ['websocket'],
		});
		sockets.push(socket);
		socket.once('connect', () => resolve(socket));
		socket.once('connect_error', reject);
	});
}

function authenticate(socket: Socket, token: string): Promise<AuthenticateSocketResponseMessage> {
	return new Promise((resolve) => {
		socket.on('message', (message: AuthenticateSocketResponseMessage) => {
			if (message.type === 'AuthenticateSocketResponseMessage') {
				resolve(message);
			}
		});
		socket.emit('message', {
			scope: SOCKET_MANAGER_SCOPE,
			type: 'AuthenticateSocketMessage',
			data: token,
		});
	});
}

afterEach(async () => {
	for (const socket of sockets.splice(0)) {
		socket.disconnect();
	}
	for (const manager of managers.splice(0)) {
		await manager.close();
	}
	for (const server of servers.splice(0)) {
		if (server.listening) {
			await new Promise<void>((resolve, reject) =>
				server.close((error) => (error ? reject(error) : resolve())),
			);
		}
	}
	vi.restoreAllMocks();
});

describe('SocketManager', () => {
	it('issues full-entropy one-time tokens', async () => {
		const { manager, url } = await createSocketManager();
		const token = manager.addTokenForUser('player-one');

		expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);

		const firstSocket = await connect(url);
		expect((await authenticate(firstSocket, token)).data).toEqual({ userId: 'player-one' });

		const secondSocket = await connect(url);
		expect((await authenticate(secondSocket, token)).data).toEqual({
			error: 'Invalid auth token',
		});
		expect(eventLog).toHaveBeenCalledWith('socket.connected', {
			socketId: firstSocket.id,
			transport: 'websocket',
		});
		expect(eventLog).toHaveBeenCalledWith(
			'socket.auth_rejected',
			{
				socketId: secondSocket.id,
				userId: undefined,
				failedAttempts: 1,
				reason: 'invalid_token',
				disconnecting: false,
			},
			'warn',
		);
		expect(JSON.stringify(eventLog.mock.calls)).not.toContain(token);
	});

	it('rejects inherited-property and non-string auth tokens without crashing', async () => {
		const { url } = await createSocketManager();
		const socket = await connect(url);

		expect((await authenticate(socket, '__proto__')).data).toEqual({
			error: 'Invalid auth token',
		});

		const malformedResponse = new Promise<AuthenticateSocketResponseMessage>((resolve) => {
			socket.once('message', resolve);
		});
		socket.emit('message', {
			scope: SOCKET_MANAGER_SCOPE,
			type: 'AuthenticateSocketMessage',
			data: { token: 'not-a-string' },
		});
		expect((await malformedResponse).data).toEqual({ error: 'Invalid auth token' });
	});

	it('records expired token rejection and pruning without exposing tokens', async () => {
		const { manager, url } = await createSocketManager();
		const socket = await connect(url);
		vi.useFakeTimers({ toFake: ['Date'] });
		vi.setSystemTime(Date.now() - 6 * 60_000);
		const token = manager.addTokenForUser('player-one');
		vi.useRealTimers();

		expect((await authenticate(socket, token)).data).toEqual({ error: 'Invalid auth token' });
		expect(eventLog).toHaveBeenCalledWith(
			'socket.auth_rejected',
			{
				socketId: socket.id,
				userId: undefined,
				failedAttempts: 1,
				reason: 'expired_token',
				disconnecting: false,
			},
			'warn',
		);
		manager.prune();
		expect(eventLog).toHaveBeenCalledWith(
			'socket.tokens_pruned',
			{ expiredTokenCount: 1 },
			'debug',
		);
		expect(JSON.stringify(eventLog.mock.calls)).not.toContain(token);
	});

	it('records safe message metadata for rejection and handler failures, excluding payloads', async () => {
		const { manager, url } = await createSocketManager();
		const socket = await connect(url);
		const scope = 'game.hanabi.11111111-1111-4111-8111-111111111111';
		const secret = 'private-chat-card-cookie-token-marker';
		const message = { scope, type: 'GetGameDataMessage', data: { secret } };
		socket.emit('message', message);
		await vi.waitFor(() =>
			expect(eventLog).toHaveBeenCalledWith(
				'socket.message_rejected',
				{
					socketId: socket.id,
					userId: undefined,
					scope,
					type: 'GetGameDataMessage',
					reason: 'unauthenticated',
				},
				'warn',
			),
		);

		socket.emit('message', { scope: secret, type: secret.repeat(5), data: secret });
		await vi.waitFor(() =>
			expect(eventLog).toHaveBeenCalledWith(
				'socket.message_rejected',
				{
					socketId: socket.id,
					userId: undefined,
					scope: 'unknown',
					type: 'unknown',
					reason: 'malformed',
				},
				'warn',
			),
		);

		const token = manager.addTokenForUser('player-one', '192.0.2.123');
		await authenticate(socket, token);
		manager.onMessage.subscribe(() => {
			throw new TypeError(`${secret}\n    at /apps/server/fake-private-frame.ts:1:2`);
		});
		socket.emit('message', message);
		await vi.waitFor(() =>
			expect(eventLog).toHaveBeenCalledWith(
				'socket.message_failed',
				expect.objectContaining({
					socketId: socket.id,
					userId: 'player-one',
					scope,
					type: 'GetGameDataMessage',
					reason: 'handler_failed',
					errorKind: 'TypeError',
				}),
				'error',
			),
		);
		const failure = eventLog.mock.calls.find(([event]) => event === 'socket.message_failed')?.[1];
		expect(failure?.sourceFrames).toContainEqual(
			expect.stringMatching(/^apps\/server\/src\/utils\/SocketManager\.test\.ts:\d+:\d+$/),
		);
		manager.sendToSocket(socket.id!, {
			scope,
			type: 'SendChatResponseMessage',
			data: { error: secret },
		});
		expect(eventLog).toHaveBeenCalledWith(
			'socket.message_sent',
			{
				socketId: socket.id,
				userId: 'player-one',
				scope,
				type: 'SendChatResponseMessage',
			},
			'debug',
		);
		const output = JSON.stringify(eventLog.mock.calls);
		for (const value of [secret, token, '192.0.2.123']) expect(output).not.toContain(value);
		expect(output).not.toContain('fake-private-frame');
	});

	it('emits disconnect only after the final socket for a user closes', async () => {
		const { manager, url } = await createSocketManager();
		const disconnectedUsers: string[] = [];
		manager.onDisconnect.subscribe(({ userId }) => disconnectedUsers.push(userId));

		const firstSocket = await connect(url);
		const secondSocket = await connect(url);
		await authenticate(firstSocket, manager.addTokenForUser('player-one'));
		await authenticate(secondSocket, manager.addTokenForUser('player-one'));
		const firstSocketId = firstSocket.id;
		const secondSocketId = secondSocket.id;
		expect(eventLog).toHaveBeenCalledWith('socket.authenticated', {
			socketId: secondSocketId,
			userId: 'player-one',
			previousUserId: undefined,
			activeSocketCount: 2,
		});
		await authenticate(secondSocket, manager.addTokenForUser('player-one'));
		expect(eventLog).toHaveBeenCalledWith('socket.authenticated', {
			socketId: secondSocketId,
			userId: 'player-one',
			previousUserId: 'player-one',
			activeSocketCount: 2,
		});

		firstSocket.disconnect();
		await new Promise((resolve) => setTimeout(resolve, 25));
		expect(disconnectedUsers).toEqual([]);
		expect(eventLog).toHaveBeenCalledWith('socket.disconnected', {
			socketId: firstSocketId,
			userId: 'player-one',
			reason: 'client namespace disconnect',
			remainingSocketCount: 1,
			playerOffline: false,
		});

		const finalDisconnect = new Promise<void>((resolve) => {
			manager.onDisconnect.subscribe(({ userId }) => {
				if (userId === 'player-one') resolve();
			});
		});
		secondSocket.disconnect();
		await finalDisconnect;

		expect(disconnectedUsers).toEqual(['player-one']);
		expect(eventLog).toHaveBeenCalledWith('socket.disconnected', {
			socketId: secondSocketId,
			userId: 'player-one',
			reason: 'client namespace disconnect',
			remainingSocketCount: 0,
			playerOffline: true,
		});
	});

	it('removes the old user association when a socket authenticates as another user', async () => {
		const { manager, url } = await createSocketManager();
		const disconnectedUsers: string[] = [];
		manager.onDisconnect.subscribe(({ userId }) => disconnectedUsers.push(userId));
		const socket = await connect(url);

		await authenticate(socket, manager.addTokenForUser('player-one'));
		await authenticate(socket, manager.addTokenForUser('player-two'));
		expect(eventLog).toHaveBeenCalledWith('socket.identity_changed', {
			socketId: socket.id,
			previousUserId: 'player-one',
			userId: 'player-two',
			remainingSocketCount: 0,
		});
		expect(eventLog).toHaveBeenCalledWith('socket.authenticated', {
			socketId: socket.id,
			previousUserId: 'player-one',
			userId: 'player-two',
			activeSocketCount: 1,
		});

		expect(disconnectedUsers).toEqual(['player-one']);
		const received: SocketMessageBase[] = [];
		socket.on('message', (message: SocketMessageBase) => received.push(message));
		manager.send('player-one', { scope: 'test', type: 'OldUserMessage', data: undefined });
		manager.send('player-two', { scope: 'test', type: 'NewUserMessage', data: undefined });
		await new Promise((resolve) => setTimeout(resolve, 25));

		expect(received.map(({ type }) => type)).toEqual(['NewUserMessage']);
	});

	it('rate limits repeated full-state requests from an authenticated socket', async () => {
		const { manager, url } = await createSocketManager();
		const socket = await connect(url);
		await authenticate(socket, manager.addTokenForUser('player-one'));
		const receivedTypes: string[] = [];
		manager.onMessage.subscribe(({ message }) => receivedTypes.push(message.type));

		for (let index = 0; index < 6; index += 1) {
			socket.emit('message', {
				scope: 'game.hanabi.test',
				type: 'GetGameDataMessage',
				data: undefined,
			});
		}
		await new Promise((resolve) => setTimeout(resolve, 25));

		expect(receivedTypes).toHaveLength(4);
		expect(eventLog).toHaveBeenCalledWith(
			'socket.message_rejected',
			{
				socketId: socket.id,
				userId: 'player-one',
				scope: 'unknown',
				type: 'GetGameDataMessage',
				reason: 'rate_limited',
			},
			'warn',
		);

		socket.disconnect();
		await new Promise((resolve) => setTimeout(resolve, 25));
		const reconnectedSocket = await connect(url);
		await authenticate(reconnectedSocket, manager.addTokenForUser('player-one'));
		reconnectedSocket.emit('message', {
			scope: 'game.hanabi.test',
			type: 'GetGameDataMessage',
			data: undefined,
		});
		await new Promise((resolve) => setTimeout(resolve, 25));

		expect(receivedTypes).toHaveLength(4);
	});
});
