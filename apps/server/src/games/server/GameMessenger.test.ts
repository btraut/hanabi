import { PubSub, SocketMessage } from '@hanabi/shared';
import { describe, expect, it, vi } from 'vitest';
import Logger from '../../utils/Logger.js';
import SocketManager from '../../utils/SocketManager.js';
import GameMessenger from './GameMessenger.js';

type TestMessage =
	| SocketMessage<'CommandMessage', undefined>
	| SocketMessage<'CommandResponseMessage', { error?: string }>
	| SocketMessage<'RefreshMessage', { value: string }>;

describe('GameMessenger', () => {
	it('sends command responses only to the socket that issued the request', () => {
		const onMessage = new PubSub<{
			socketId: string;
			userId: string | undefined;
			message: TestMessage;
		}>();
		const send = vi.fn();
		const sendToSocket = vi.fn();
		const socketManager = {
			onMessage,
			send,
			sendToSocket,
		} as unknown as SocketManager;
		const messenger = new GameMessenger(socketManager, 'game.test');
		messenger.connect(({ userId }) => {
			messenger.send(userId, { type: 'CommandResponseMessage', data: {} });
			messenger.send(userId, { type: 'RefreshMessage', data: { value: 'updated' } });
		});

		onMessage.emit({
			socketId: 'origin-socket',
			userId: 'player',
			message: { scope: 'game.test', type: 'CommandMessage', data: undefined },
		});

		expect(sendToSocket).toHaveBeenCalledWith(
			'origin-socket',
			expect.objectContaining({ type: 'CommandResponseMessage' }),
		);
		expect(send).toHaveBeenCalledWith(
			'player',
			expect.objectContaining({ type: 'RefreshMessage' }),
		);
	});
});

it('correlates rejected replies to their originating request without logging unrelated data', () => {
	const log = vi.spyOn(Logger, 'event').mockImplementation(() => undefined);
	const onMessage = new PubSub<{ socketId: string; userId: string; message: TestMessage }>();
	const sockets = { onMessage, send: vi.fn(), sendToSocket: vi.fn() };
	const messenger = new GameMessenger<TestMessage>(
		sockets as unknown as SocketManager,
		'game.test',
		() => ({ gameId: 'game-id', gameCode: 'abdegj' }),
	);
	const origins: Array<string | undefined> = [];
	messenger.connect(({ userId, socketId }) => {
		origins.push(socketId);
		messenger.send(userId, {
			type: 'CommandResponseMessage',
			data: { error: 'Cannot remove a player after start.' },
		});
		messenger.send(userId, {
			type: 'RefreshMessage',
			data: { value: 'private-game-state-sentinel' },
		});
	});
	try {
		onMessage.emit({
			userId: 'player',
			socketId: 'tab-two',
			message: { scope: 'game.test', type: 'CommandMessage', data: undefined },
		});
		expect(origins).toEqual(['tab-two']);
		expect(log).toHaveBeenCalledExactlyOnceWith(
			'game.request_rejected',
			{
				gameId: 'game-id',
				gameCode: 'abdegj',
				scope: 'game.test',
				userId: 'player',
				socketId: 'tab-two',
				requestType: 'CommandMessage',
				responseType: 'CommandResponseMessage',
				reason: 'Cannot remove a player after start.',
			},
			'warn',
		);
		expect(JSON.stringify(log.mock.calls)).not.toContain('private-game-state-sentinel');
		expect(messenger.requestSocketId).toBeUndefined();
		expect(sockets.sendToSocket).toHaveBeenCalledWith(
			'tab-two',
			expect.objectContaining({ type: 'CommandResponseMessage' }),
		);
	} finally {
		messenger.disconnect();
		log.mockRestore();
	}
});
