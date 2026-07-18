import { afterEach, describe, expect, it, vi } from 'vitest';
import Ajax from './Ajax';

describe('Ajax', () => {
	it('does not attach a body to GET requests', async () => {
		const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
			new Response(JSON.stringify({ ok: true }), {
				status: 200,
				headers: { 'Content-Type': 'application/json' },
			}),
		);

		await expect(Ajax.get('/api/auth-socket')).resolves.toEqual({ ok: true });
		expect(fetchMock).toHaveBeenCalledOnce();
		expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/auth-socket');
		expect(fetchMock.mock.calls[0]?.[1]).not.toHaveProperty('body');
	});

	afterEach(() => {
		vi.restoreAllMocks();
		vi.useRealTimers();
	});

	it('rejects non-success HTTP responses', async () => {
		vi.spyOn(globalThis, 'fetch').mockResolvedValue(
			new Response(JSON.stringify({ error: 'Too many authentication attempts.' }), {
				status: 429,
				headers: { 'Content-Type': 'application/json' },
			}),
		);

		await expect(Ajax.get('/api/auth-socket')).rejects.toThrow('HTTP 429');
	});

	it('aborts requests that exceed their timeout', async () => {
		vi.useFakeTimers();
		vi.spyOn(globalThis, 'fetch').mockImplementation(
			(_url, options) =>
				new Promise((_resolve, reject) => {
					options?.signal?.addEventListener('abort', () =>
						reject(new DOMException('aborted', 'AbortError')),
					);
				}),
		);

		const request = Ajax.get('/api/auth-socket', undefined, 50);
		const assertion = expect(request).rejects.toThrow('timed out');
		await vi.advanceTimersByTimeAsync(50);

		await assertion;
	});
});
