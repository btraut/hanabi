import {
	AuthenticateSocketResponseMessage,
	SOCKET_MANAGER_SCOPE,
	SocketMessageBase,
} from '@hanabi/shared';
import { afterEach, describe, expect, it } from 'vitest';
import { createServer, Server as HTTPServer } from 'node:http';
import { AddressInfo } from 'node:net';
import { io, Socket } from 'socket.io-client';
import SocketManager from './SocketManager.js';

const sockets: Socket[] = [];
const servers: HTTPServer[] = [];
const managers: SocketManager[] = [];

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

	it('emits disconnect only after the final socket for a user closes', async () => {
		const { manager, url } = await createSocketManager();
		const disconnectedUsers: string[] = [];
		manager.onDisconnect.subscribe(({ userId }) => disconnectedUsers.push(userId));

		const firstSocket = await connect(url);
		const secondSocket = await connect(url);
		await authenticate(firstSocket, manager.addTokenForUser('player-one'));
		await authenticate(secondSocket, manager.addTokenForUser('player-one'));

		firstSocket.disconnect();
		await new Promise((resolve) => setTimeout(resolve, 25));
		expect(disconnectedUsers).toEqual([]);

		const finalDisconnect = new Promise<void>((resolve) => {
			manager.onDisconnect.subscribe(({ userId }) => {
				if (userId === 'player-one') resolve();
			});
		});
		secondSocket.disconnect();
		await finalDisconnect;

		expect(disconnectedUsers).toEqual(['player-one']);
	});

	it('removes the old user association when a socket authenticates as another user', async () => {
		const { manager, url } = await createSocketManager();
		const disconnectedUsers: string[] = [];
		manager.onDisconnect.subscribe(({ userId }) => disconnectedUsers.push(userId));
		const socket = await connect(url);

		await authenticate(socket, manager.addTokenForUser('player-one'));
		await authenticate(socket, manager.addTokenForUser('player-two'));

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
