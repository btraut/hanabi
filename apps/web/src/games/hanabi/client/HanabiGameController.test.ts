import { describe, expect, it, vi } from 'vitest';
import { initializeGameMessenger } from './initializeGameMessenger';

describe('initializeGameMessenger', () => {
	it('cleans up a temporary messenger when its initial refresh fails', async () => {
		const error = new Error('refresh failed');
		const messenger = {
			refreshGameData: vi.fn().mockRejectedValue(error),
			cleanUp: vi.fn(),
		};

		await expect(initializeGameMessenger(messenger)).rejects.toBe(error);
		expect(messenger.cleanUp).toHaveBeenCalledTimes(1);
	});

	it('keeps a successfully initialized messenger active', async () => {
		const messenger = {
			refreshGameData: vi.fn().mockResolvedValue(undefined),
			cleanUp: vi.fn(),
		};

		await expect(initializeGameMessenger(messenger)).resolves.toBe(messenger);
		expect(messenger.cleanUp).not.toHaveBeenCalled();
	});
});
