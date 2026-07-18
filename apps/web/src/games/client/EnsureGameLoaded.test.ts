import { describe, expect, it, vi } from 'vitest';
import { loadGameUntilSuccessful } from './loadGameUntilSuccessful';

describe('loadGameUntilSuccessful', () => {
	it('retains the load operation and retries transient failures', async () => {
		const loadGame = vi
			.fn<() => Promise<void>>()
			.mockRejectedValueOnce(new Error('socket disconnected'))
			.mockResolvedValueOnce(undefined);
		const wait = vi.fn().mockResolvedValue(undefined);

		await expect(loadGameUntilSuccessful(loadGame, () => true, wait)).resolves.toBe(true);
		expect(loadGame).toHaveBeenCalledTimes(2);
		expect(wait).toHaveBeenCalledTimes(1);
	});

	it('stops retrying after the component is no longer active', async () => {
		let active = true;
		const loadGame = vi.fn().mockRejectedValue(new Error('socket disconnected'));
		const wait = vi.fn().mockImplementation(() => {
			active = false;
			return Promise.resolve();
		});

		await expect(loadGameUntilSuccessful(loadGame, () => active, wait)).resolves.toBe(false);
		expect(loadGame).toHaveBeenCalledTimes(1);
	});

	it('surfaces permanent failures without retrying', async () => {
		const permanentError = new Error('game does not exist');
		const loadGame = vi.fn().mockRejectedValue(permanentError);
		const wait = vi.fn().mockResolvedValue(undefined);

		await expect(
			loadGameUntilSuccessful(
				loadGame,
				() => true,
				wait,
				(error) => error !== permanentError,
			),
		).rejects.toBe(permanentError);
		expect(loadGame).toHaveBeenCalledOnce();
		expect(wait).not.toHaveBeenCalled();
	});
});
