import { afterEach, describe, expect, it, vi } from 'vitest';
import { AddressInfo } from 'node:net';
import { HanabiFinishedReason, type GameTranscriptV1 } from '@hanabi/shared';
import { ADMIN_SESSION_COOKIE_NAME } from './admin.js';
import { createApp, ServerRuntime } from './app.js';
import type {
	AdminTranscriptSummaryPage,
	GameTranscriptSummaryReader,
} from './games/hanabi/PostgresGameTranscriptSummaryReader.js';

const runtimes: ServerRuntime[] = [];

function finishedTranscript(): GameTranscriptV1 {
	const result = {
		finishedReason: HanabiFinishedReason.OutOfTurns,
		score: 0,
		clues: 8,
		lives: 3,
		remainingTurns: 0,
	};
	return {
		version: 1,
		revision: 2,
		roundId: 'round-1',
		gameId: 'expired-game',
		gameCode: 'ABCDEF',
		rules: { ruleSet: '5-color', criticalGameOver: false, allowDragging: true, showNotes: true },
		players: [
			{ id: 'alice', name: 'Alice' },
			{ id: 'bob', name: 'Bob' },
		],
		dealOrder: [
			{ playerId: 'alice', tileIds: ['red-1'] },
			{ playerId: 'bob', tileIds: ['blue-1'] },
		],
		turnOrder: ['alice', 'bob'],
		deck: [
			{ id: 'red-1', color: 'red', number: 1 },
			{ id: 'blue-1', color: 'blue', number: 1 },
		],
		moves: [
			{
				type: 'discard',
				actionId: 'move-1',
				index: 0,
				actorId: 'alice',
				tileId: 'red-1',
				createdAt: '2026-09-13T12:00:00.000Z',
				postTurn: { ...result, nextPlayerId: 'bob', status: 'finished', result },
			},
		],
		lifecycle: {
			status: 'finished',
			startedAt: '2026-09-13T11:59:00.000Z',
			updatedAt: '2026-09-13T12:00:00.000Z',
			endedAt: '2026-09-13T12:00:00.000Z',
		},
		integrity: { status: 'complete' },
		result,
	};
}

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
	it('serves a stored finished replay only to a signed admin session without joining its game', async () => {
		const transcript = finishedTranscript();
		const get = vi.fn().mockResolvedValue(transcript);
		const origin = await startRuntime({ list: vi.fn(), get });
		const url = `${origin}/api/admin/transcripts/${transcript.roundId}`;

		const anonymous = await fetch(url);
		expect(anonymous.status).toBe(401);
		expect(get).not.toHaveBeenCalled();
		const forged = await fetch(url, {
			headers: { cookie: `${ADMIN_SESSION_COOKIE_NAME}=authorized` },
		});
		expect(forged.status).toBe(401);
		expect(get).not.toHaveBeenCalled();

		const cookie = (await login(origin)).headers.get('set-cookie')!.split(';', 1)[0];
		const response = await fetch(url, { headers: { cookie } });
		expect(response.status).toBe(200);
		expect(response.headers.get('cache-control')).toBe('no-store');
		expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow');
		await expect(response.json()).resolves.toEqual(transcript);
		expect(get).toHaveBeenCalledExactlyOnceWith('round-1');
	});

	it('validates archive IDs and reports missing rounds', async () => {
		const get = vi.fn().mockResolvedValue(null);
		const origin = await startRuntime({ list: vi.fn(), get });
		const cookie = (await login(origin)).headers.get('set-cookie')!.split(';', 1)[0];
		for (const id of ['bad id', 'bad/id', 'a'.repeat(129)]) {
			const response = await fetch(`${origin}/api/admin/transcripts/${encodeURIComponent(id)}`, {
				headers: { cookie },
			});
			expect(response.status).toBe(400);
			await expect(response.json()).resolves.toEqual({ error: 'Invalid round ID.' });
		}
		expect(get).not.toHaveBeenCalled();
		const missing = await fetch(`${origin}/api/admin/transcripts/missing-round`, {
			headers: { cookie },
		});
		expect(missing.status).toBe(404);
		await expect(missing.json()).resolves.toEqual({ error: 'Round not found.' });
	});

	it.each([
		'in_progress',
		'reset',
		'partial',
		'conflicted',
		'missing-deck',
		'missing-deal',
		'missing-result',
		'unfinished-moves',
	])('refuses %s transcripts without exposing their contents', async (reason) => {
		const transcript = finishedTranscript();
		if (reason === 'in_progress' || reason === 'reset') transcript.lifecycle.status = reason;
		else if (reason === 'partial' || reason === 'conflicted') transcript.integrity.status = reason;
		else if (reason === 'missing-deck') transcript.deck = null;
		else if (reason === 'missing-deal') transcript.dealOrder = null;
		else if (reason === 'missing-result') delete transcript.result;
		else transcript.moves[0].postTurn.status = 'in_progress';
		const origin = await startRuntime({
			list: vi.fn(),
			get: vi.fn().mockResolvedValue(transcript),
		});
		const cookie = (await login(origin)).headers.get('set-cookie')!.split(';', 1)[0];
		const response = await fetch(`${origin}/api/admin/transcripts/round-1`, {
			headers: { cookie },
		});
		expect(response.status).toBe(409);
		await expect(response.json()).resolves.toEqual({
			error: 'Only complete, finished rounds can be replayed.',
		});
	});

	it.each([false, true])(
		'handles unavailable replay storage (configured: %s)',
		async (configured) => {
			const reader = configured
				? { list: vi.fn(), get: vi.fn().mockRejectedValue(new Error('password=database-secret')) }
				: undefined;
			const origin = await startRuntime(reader);
			const cookie = (await login(origin)).headers.get('set-cookie')!.split(';', 1)[0];
			const response = await fetch(`${origin}/api/admin/transcripts/round-1`, {
				headers: { cookie },
			});
			expect(response.status).toBe(503);
			await expect(response.json()).resolves.toEqual({ error: 'Round replay is unavailable.' });
		},
	);

	it('keeps transcript summaries hidden until a valid password creates a signed session', async () => {
		const page: AdminTranscriptSummaryPage = {
			items: [
				{
					roundId: 'round-1',
					gameCode: 'ABCDEF',
					recordedAt: '2026-09-03T10:00:00.000Z',
					status: 'finished',
					integrity: 'complete',
					initialSettings: {
						ruleSet: '5-color',
						criticalGameOver: false,
						allowDragging: true,
						showNotes: true,
					},
					playerNames: ['Alice', 'Bob'],
					moveCount: 18,
					score: 12,
					finishedReason: HanabiFinishedReason.OutOfTurns,
				},
			],
			page: 2,
			pageSize: 25,
			total: 30,
		};
		const list = vi.fn().mockResolvedValue(page);
		const reader: GameTranscriptSummaryReader = { list, get: vi.fn() };
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
		const reader: GameTranscriptSummaryReader = { list, get: vi.fn() };
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
			get: vi.fn(),
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
