import { describe, expect, it } from 'vitest';
import SocketManager from './SocketManager';

interface TestMessage {
	readonly scope: string;
	readonly type: string;
	readonly data: string;
}

function receive(manager: SocketManager<TestMessage>, message: TestMessage): void {
	(
		manager as unknown as {
			_handleMessage(message: TestMessage): void;
		}
	)._handleMessage(message);
}

describe('SocketManager expectations', () => {
	it('resolves only the oldest matching expectation', async () => {
		const manager = new SocketManager<TestMessage>();
		const first = manager.expectMessageOfType<TestMessage>('Response', 'game-a');
		const second = manager.expectMessageOfType<TestMessage>('Response', 'game-a');
		let secondResolved = false;
		void second.then(() => {
			secondResolved = true;
		});

		receive(manager, { scope: 'game-a', type: 'Response', data: 'first' });

		await expect(first).resolves.toMatchObject({ data: 'first' });
		await Promise.resolve();
		expect(secondResolved).toBe(false);

		receive(manager, { scope: 'game-a', type: 'Response', data: 'second' });
		await expect(second).resolves.toMatchObject({ data: 'second' });
	});

	it('does not match a response from another scope', async () => {
		const manager = new SocketManager<TestMessage>();
		const response = manager.expectMessageOfType<TestMessage>('Response', 'game-a');
		let resolved = false;
		void response.then(() => {
			resolved = true;
		});

		receive(manager, { scope: 'game-b', type: 'Response', data: 'wrong game' });
		await Promise.resolve();
		expect(resolved).toBe(false);

		receive(manager, { scope: 'game-a', type: 'Response', data: 'right game' });
		await expect(response).resolves.toMatchObject({ data: 'right game' });
	});
});
