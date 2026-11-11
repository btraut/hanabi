import { access, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { request } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { BenchReviewSnapshot } from '@hanabi/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BenchGame } from './engine.js';
import { serveReviewDirectory, type ReviewServer } from './reviewServer.js';
import { writeJson } from './storage.js';

describe('Bench local review HTTP server', () => {
	let directory: string;
	let artifacts: string;
	let assets: string;
	const servers: ReviewServer[] = [];

	beforeEach(async () => {
		directory = await mkdtemp(join(tmpdir(), 'hanabi-review-server-'));
		artifacts = join(directory, 'artifacts');
		assets = join(directory, 'assets');
		await Promise.all([mkdir(artifacts), mkdir(assets)]);
		await writeFile(
			join(assets, 'bench.html'),
			'<!doctype html><title>Bench review fixture</title>',
		);
		await writeFile(join(assets, 'app.js'), '/* viewer asset */');
		const game = new BenchGame({
			seed: 'http-review',
			playerCount: 3,
			ruleSet: '5-color',
			criticalGameOver: true,
		});
		await writeJson(join(artifacts, 'transcript.json'), game.transcript());
		await writeJson(join(artifacts, 'private/player-1.json'), [
			{
				turn: 0,
				opportunity: 'turn',
				response: { explanation: 'Private diagnostic explanation.' },
			},
		]);
		await writeFile(join(directory, 'outside-secret.txt'), 'outside-root-secret');
	});

	afterEach(async () => {
		await Promise.all(servers.splice(0).map((server) => server.close()));
		await rm(directory, { recursive: true, force: true });
	});

	async function start(
		options: {
			directory?: string;
			allowMissing?: boolean;
			port?: number;
			signal?: AbortSignal;
		} = {},
	) {
		const server = await serveReviewDirectory({
			directory: artifacts,
			assetsDirectory: assets,
			port: 0,
			...options,
		});
		servers.push(server);
		const url = new URL(server.url);
		const token = new URLSearchParams(url.hash.slice(1)).get('token')!;
		return { server, origin: url.origin, token, headers: { Authorization: `Bearer ${token}` } };
	}

	it('serves only built assets and authenticated review snapshots with no-store headers', async () => {
		const { server, origin, token, headers } = await start();
		expect(server.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/#token=/);
		expect(token).toBeTruthy();
		const page = await fetch(`${origin}/`);
		expect(page.status).toBe(200);
		expect(await page.text()).toContain('Bench review fixture');
		const asset = await fetch(`${origin}/app.js`);
		expect(asset.status).toBe(200);
		expect(await asset.text()).toContain('viewer asset');
		const response = await fetch(`${origin}/api/review`, { headers });
		expect(response.status).toBe(200);
		expect(response.headers.get('cache-control')).toBe('no-store');
		expect(response.headers.get('referrer-policy')).toBe('no-referrer');
		expect(response.headers.get('x-content-type-options')).toBe('nosniff');
		expect(response.headers.get('x-powered-by')).toBeNull();
		const snapshot = (await response.json()) as BenchReviewSnapshot;
		expect(snapshot.source).toBe(await realpath(artifacts));
		expect(snapshot.selectedGameId).toBe('.');
		expect(snapshot.game!.transcript.moves).toEqual([]);
		expect(snapshot.game!.logs[0].text).toBe('Private diagnostic explanation.');
		expect(JSON.stringify(snapshot)).not.toContain(token);
	});

	it('rejects missing/wrong tokens, cross-origin requests, and unexpected Host headers', async () => {
		const { origin, token, headers } = await start();
		const responses = await Promise.all([
			fetch(`${origin}/api/review`),
			fetch(`${origin}/api/review?token=${token}`),
			fetch(`${origin}/api/review`, {
				headers: { Authorization: `Bearer ${'x'.repeat(token.length)}` },
			}),
			fetch(`${origin}/api/review`, {
				headers: { ...headers, Origin: 'https://elsewhere.invalid' },
			}),
			fetch(`${origin}/api/review`, { headers: { ...headers, Origin: 'null' } }),
		]);
		for (const [index, response] of responses.entries()) {
			expect(response.status, `rejection case ${index}`).toBe(403);
			expect(await response.text()).not.toContain('Private diagnostic explanation.');
		}
		// Node's fetch replaces Host; use a raw request to exercise the server's Host check.
		const wrongHost = await new Promise<{ status: number; body: string }>((resolve, reject) => {
			const req = request(
				`${origin}/api/review`,
				{ headers: { ...headers, Host: 'elsewhere.invalid' } },
				(res) => {
					let body = '';
					res.setEncoding('utf8');
					res.on('data', (chunk: string) => {
						body += chunk;
					});
					res.on('end', () => resolve({ status: res.statusCode!, body }));
				},
			);
			req.on('error', reject);
			req.end();
		});
		expect(wrongHost.status).toBe(403);
		expect(wrongHost.body).not.toContain('Private diagnostic explanation.');
		const sameOrigin = await fetch(`${origin}/api/review`, {
			headers: { ...headers, Origin: origin },
		});
		expect(sameOrigin.status).toBe(200);
	});

	it('rejects unknown game IDs and malformed game query parameters', async () => {
		const { origin, headers } = await start();
		for (const id of [
			'../outside-secret.txt',
			'/tmp',
			'private/player-1.json',
			'iterations/9999/game',
		]) {
			const response = await fetch(`${origin}/api/review?game=${encodeURIComponent(id)}`, {
				headers,
			});
			expect(response.status).toBe(404);
			expect(await response.json()).toEqual({ error: 'Unknown review game.' });
		}
		const duplicate = await fetch(`${origin}/api/review?game=.&game=other`, { headers });
		expect(duplicate.status).toBe(400);
		const pinned = await fetch(`${origin}/api/review?game=.`, { headers });
		expect(pinned.status).toBe(200);
	});

	it('does not serve raw artifacts, private logs, filesystem routes, or neighboring files', async () => {
		const { origin, headers } = await start();
		for (const path of [
			'/transcript.json',
			'/private/player-1.json',
			'/config.json',
			'/state.json',
			'/.context/hanabi-bench/transcript.json',
			'/@fs/outside-secret.txt',
			'/..%2Foutside-secret.txt',
			'/api/private/player-1.json',
		]) {
			const response = await fetch(`${origin}${path}`, { headers });
			expect(response.status, path).toBe(404);
			const body = await response.text();
			expect(body).not.toContain('Private diagnostic explanation.');
			expect(body).not.toContain('outside-root-secret');
			expect(body).not.toContain('initialState');
		}
	});

	it('watches a not-yet-created run without creating it and reads it when artifacts arrive', async () => {
		const future = join(directory, 'future-run');
		const { origin, headers } = await start({ directory: future, allowMissing: true });
		await expect(access(future)).rejects.toMatchObject({ code: 'ENOENT' });
		const waiting = await fetch(`${origin}/api/review`, { headers });
		expect(waiting.status).toBe(200);
		expect(await waiting.json()).toMatchObject({ games: [], selectedGameId: null, game: null });
		await expect(access(future)).rejects.toMatchObject({ code: 'ENOENT' });
		const source = await readFile(join(artifacts, 'transcript.json'), 'utf8');
		await mkdir(future);
		await writeFile(join(future, 'transcript.json'), source);
		const live = await fetch(`${origin}/api/review`, { headers });
		expect(live.status).toBe(200);
		expect(await live.json()).toMatchObject({ selectedGameId: '.', game: { status: 'playing' } });
		expect(await readFile(join(future, 'transcript.json'), 'utf8')).toBe(source);
	});

	it('reports corrupt artifacts as an error without modifying them', async () => {
		const { origin, headers } = await start();
		const path = join(artifacts, 'transcript.json');
		const corrupt = '{not valid JSON';
		await writeFile(path, corrupt);
		const response = await fetch(`${origin}/api/review`, { headers });
		expect(response.status).toBe(500);
		expect(await response.json()).toHaveProperty('error');
		expect(await readFile(path, 'utf8')).toBe(corrupt);
	});

	it('rejects a pre-aborted start before opening a listener', async () => {
		const controller = new AbortController();
		const reason = new Error('Review start was cancelled.');
		controller.abort(reason);
		await expect(
			serveReviewDirectory({
				directory: artifacts,
				assetsDirectory: assets,
				port: 0,
				signal: controller.signal,
			}),
		).rejects.toBe(reason);
	});

	it('closes the live listener when its abort signal fires', async () => {
		const controller = new AbortController();
		const { server, origin, headers } = await start({ signal: controller.signal });
		expect((await fetch(`${origin}/api/review`, { headers })).status).toBe(200);
		controller.abort(new Error('Viewer closed by caller.'));
		await server.closed;
		await expect(fetch(`${origin}/api/review`, { headers })).rejects.toThrow();
		await server.close();
	});

	it('closes idempotently and rejects missing directories or invalid ports before listening', async () => {
		const { server, origin, headers } = await start();
		await Promise.all([server.close(), server.close(), server.closed]);
		await expect(fetch(`${origin}/api/review`, { headers })).rejects.toThrow();
		await expect(
			serveReviewDirectory({
				directory: join(directory, 'missing'),
				assetsDirectory: assets,
				port: 0,
			}),
		).rejects.toMatchObject({ code: 'ENOENT' });
		for (const port of [-1, 65536, 1.5]) {
			await expect(
				serveReviewDirectory({ directory: artifacts, assetsDirectory: assets, port }),
			).rejects.toThrow(/port/);
		}
		await expect(
			serveReviewDirectory({
				directory: join(directory, 'outside-secret.txt'),
				assetsDirectory: assets,
				port: 0,
			}),
		).rejects.toThrow(/directory/);
	});
});
