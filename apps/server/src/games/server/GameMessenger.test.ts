import { PubSub, SocketMessage } from '@hanabi/shared';
import { describe, expect, it, vi } from 'vitest';
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
