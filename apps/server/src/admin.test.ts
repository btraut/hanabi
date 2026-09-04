import { afterEach, describe, expect, it, vi } from 'vitest';
import { AddressInfo } from 'node:net';
import { ADMIN_SESSION_COOKIE_NAME } from './admin.js';
import { createApp, ServerRuntime } from './app.js';
import type {
	AdminTranscriptSummaryPage,
	GameTranscriptSummaryReader,
} from './games/hanabi/PostgresGameTranscriptSummaryReader.js';

const runtimes: ServerRuntime[] = [];

async function startRuntime(reader?: GameTranscriptSummaryReader) {
	const runtime = createApp({
		nodeEnv: 'development',
		sessionCookieSecret: 'integration-test-secret-at-least-32-chars',
		adminPassword: 'secret',
		transcriptSummaryReader: reader,
	});
	runtimes.push(runtime);
	await runtime.listen(0, '127.0.0.1');
	const address = runtime.httpServer.address() as AddressInfo;
	return `http://127.0.0.1:${address.port}`;
}

async function login(origin: string, password = 'secret'): Promise<Response> {
	return fetch(`${origin}/api/admin/session`, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ password }),
	});
}

afterEach(async () => {
	for (const runtime of runtimes.splice(0)) await runtime.close();
});

describe('admin routes', () => {
	it('keeps transcript summaries hidden until a valid password creates a signed session', async () => {
		const page: AdminTranscriptSummaryPage = {
			items: [
				{
					roundId: 'round-1',
					gameCode: 'ABCDEF',
					recordedAt: '2026-09-03T10:00:00.000Z',
					status: 'finished',
					integrity: 'complete',
					playerNames: ['Alice', 'Bob'],
					moveCount: 18,
					score: 12,
					finishedReason: 'OutOfTurns',
				},
			],
			page: 2,
			pageSize: 25,
			total: 30,
		};
		const list = vi.fn().mockResolvedValue(page);
		const reader: GameTranscriptSummaryReader = { list };
		const origin = await startRuntime(reader);

		const anonymous = await fetch(`${origin}/api/admin/transcripts?page=2`);
		expect(anonymous.status).toBe(401);
		await expect(anonymous.json()).resolves.toEqual({ error: 'Authentication required.' });
		expect(list).not.toHaveBeenCalled();

		const rejected = await login(origin, 'wrong');
		expect(rejected.status).toBe(401);
		expect(rejected.headers.get('set-cookie')).toBeNull();
		await expect(rejected.json()).resolves.toEqual({ error: 'Invalid password.' });

		const accepted = await login(origin);
		const setCookie = accepted.headers.get('set-cookie');
		expect(accepted.status).toBe(204);
		expect(setCookie).toMatch(new RegExp(`^${ADMIN_SESSION_COOKIE_NAME}=s%3A`));
		expect(setCookie).toContain('HttpOnly');
		expect(setCookie).toContain('Path=/api/admin');
		expect(setCookie).toContain('SameSite=Strict');
		expect(setCookie).not.toContain('Max-Age');

		const cookie = setCookie!.split(';', 1)[0];
		const authorized = await fetch(`${origin}/api/admin/transcripts?page=2`, {
			headers: { cookie },
		});
		expect(authorized.status).toBe(200);
		expect(authorized.headers.get('cache-control')).toBe('no-store');
		expect(authorized.headers.get('x-robots-tag')).toBe('noindex, nofollow');
		await expect(authorized.json()).resolves.toEqual(page);
		expect(list).toHaveBeenCalledWith(2);

		const lastCharacter = cookie.at(-1);
		const tamperedCookie = `${cookie.slice(0, -1)}${lastCharacter === 'a' ? 'b' : 'a'}`;
		const tampered = await fetch(`${origin}/api/admin/transcripts`, {
			headers: { cookie: tamperedCookie },
		});
		expect(tampered.status).toBe(401);
	});

	it('clears the admin session and validates page numbers before querying', async () => {
		const list = vi.fn().mockResolvedValue({ items: [], page: 1, pageSize: 25, total: 0 });
		const reader: GameTranscriptSummaryReader = { list };
		const origin = await startRuntime(reader);
		const cookie = (await login(origin)).headers.get('set-cookie')!.split(';', 1)[0];

		for (const page of ['0', '-1', '1.5', 'wat']) {
			const response = await fetch(`${origin}/api/admin/transcripts?page=${page}`, {
				headers: { cookie },
			});
			expect(response.status).toBe(400);
			await expect(response.json()).resolves.toEqual({
				error: 'Page must be a positive integer.',
			});
		}
		expect(list).not.toHaveBeenCalled();

		const logout = await fetch(`${origin}/api/admin/session`, {
			method: 'DELETE',
			headers: { cookie },
		});
		expect(logout.status).toBe(204);
		expect(logout.headers.get('set-cookie')).toContain(`${ADMIN_SESSION_COOKIE_NAME}=;`);
		expect(logout.headers.get('set-cookie')).toContain('Path=/api/admin');
	});

	it('returns a generic unavailable response without leaking database errors', async () => {
		const reader: GameTranscriptSummaryReader = {
			list: vi.fn().mockRejectedValue(new Error('password=database-secret')),
		};
		const origin = await startRuntime(reader);
		const cookie = (await login(origin)).headers.get('set-cookie')!.split(';', 1)[0];

		const response = await fetch(`${origin}/api/admin/transcripts`, {
			headers: { cookie },
		});
		expect(response.status).toBe(503);
		const body = JSON.stringify(await response.json());
		expect(body).toBe('{"error":"Round history is unavailable."}');
		expect(body).not.toContain('database-secret');
	});
});
