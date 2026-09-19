import { describe, expect, it, vi } from 'vitest';
// The operator CLI runs directly in Node without a build step.
// @ts-expect-error JavaScript helper has no declaration file.
import {
	createClient,
	fetchRound,
	listRounds,
	matchesRound,
	parseOptions,
} from './game-transcript.mjs';

describe('production transcript helper', () => {
	it('filters by code, player and an explicit timezone window', () => {
		const options = parseOptions([
			'list',
			'--code',
			'ABCDEF',
			'--player',
			'brent',
			'--after',
			'2026-09-18T00:00:00-07:00',
			'--before',
			'2026-09-19T00:00:00-07:00',
		]);
		const round = {
			gameCode: 'abcdef',
			playerNames: ['Brent'],
			recordedAt: '2026-09-18T07:00:00Z',
		};
		expect(matchesRound(round, options)).toBe(true);
		expect(matchesRound({ ...round, recordedAt: '2026-09-19T07:00:00Z' }, options)).toBe(false);
		expect(matchesRound({ ...round, playerNames: ['Someone else'] }, options)).toBe(false);
		expect(() => parseOptions(['list', '--after', '2026-09-18'])).toThrow('UTC offset');
		expect(() => parseOptions(['fetch', '../../secret'])).toThrow('round ID');
		expect(() => parseOptions(['list', '--player', 'A', '--player', 'B'])).toThrow('repeated');
	});

	it('scans every page and retains distinct rounds in the same lobby', async () => {
		const get = vi
			.fn()
			.mockResolvedValueOnce({
				page: 1,
				pageSize: 1,
				total: 2,
				items: [{ roundId: 'r1', gameCode: 'ABCDEF' }],
			})
			.mockResolvedValueOnce({
				page: 2,
				pageSize: 1,
				total: 2,
				items: [{ roundId: 'r2', gameCode: 'ABCDEF' }],
			});
		expect(await listRounds(get, { code: 'ABCDEF' })).toHaveLength(2);
		expect(get.mock.calls).toEqual([['transcripts?page=1'], ['transcripts?page=2']]);
	});

	it('falls back only for a missing export endpoint and validates round identity', async () => {
		const transcript = { roundId: 'r1', moves: [] };
		const get = vi.fn().mockRejectedValueOnce({ status: 404 }).mockResolvedValueOnce(transcript);
		expect(await fetchRound(get, 'r1')).toEqual(transcript);
		expect(get.mock.calls).toEqual([['transcripts/r1/export'], ['transcripts/r1']]);
		const unavailable = vi.fn().mockRejectedValue({ status: 503 });
		await expect(fetchRound(unavailable, 'r1')).rejects.toEqual({ status: 503 });
		expect(unavailable).toHaveBeenCalledTimes(1);
		const spaFallback = vi
			.fn()
			.mockRejectedValueOnce({ code: 'NON_JSON_RESPONSE' })
			.mockResolvedValueOnce(transcript);
		expect(await fetchRound(spaFallback, 'r1')).toEqual(transcript);
		await expect(fetchRound(vi.fn().mockResolvedValue(transcript), 'r2')).rejects.toThrow(
			'requested round',
		);
	});

	it('uses the returned signed session and refuses redirects for credentials and downloads', async () => {
		const request = vi
			.fn()
			.mockResolvedValueOnce(
				new Response(null, {
					status: 204,
					headers: { 'set-cookie': 'HANABI_ADMIN=s%3Asigned; HttpOnly; Path=/api/admin' },
				}),
			)
			.mockResolvedValueOnce(Response.json({ items: [] }));
		const get = await createClient('private-password', request);
		await expect(get('transcripts?page=1')).resolves.toEqual({ items: [] });
		expect(request.mock.calls[0][1]).toMatchObject({ redirect: 'error', method: 'POST' });
		expect(request.mock.calls[1][1]).toMatchObject({
			redirect: 'error',
			headers: { cookie: 'HANABI_ADMIN=s%3Asigned' },
		});
		await expect(
			createClient(
				'private-password',
				vi.fn().mockResolvedValue(new Response('secret detail', { status: 401 })),
			),
		).rejects.toThrow('Admin authentication failed (HTTP 401).');
	});
});
