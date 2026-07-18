import { createServer } from 'node:net';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { allocatePort, portRanges, preferredPort, writeManifest } from './dev-runtime.mjs';

const listeners: ReturnType<typeof createServer>[] = [];

afterEach(async () => {
	await Promise.all(
		listeners.splice(0).map((server) => new Promise((resolve) => server.close(resolve))),
	);
});

describe('development runtime ports', () => {
	it('returns stable preferred ports in disjoint service ranges', () => {
		const root = '/tmp/hanabi-worktree';
		expect(preferredPort(root, 'server')).toBe(preferredPort(root, 'server'));
		expect(preferredPort(root, 'web')).toBe(preferredPort(root, 'web'));
		expect(preferredPort(root, 'server')).toBeGreaterThanOrEqual(portRanges.server.min);
		expect(preferredPort(root, 'server')).toBeLessThanOrEqual(portRanges.server.max);
		expect(preferredPort(root, 'web')).toBeGreaterThanOrEqual(portRanges.web.min);
		expect(preferredPort(root, 'web')).toBeLessThanOrEqual(portRanges.web.max);
	});

	it('selects the next candidate when the preferred port is occupied', async () => {
		const range = { min: 45000, max: 45002 };
		const preferred = preferredPort('/tmp/collision', 'server', range);
		const listener = createServer().listen(preferred, '127.0.0.1');
		listeners.push(listener);
		await new Promise((resolve) => listener.once('listening', resolve));

		expect(await allocatePort('/tmp/collision', 'server', { range })).toBe(
			range.min + ((preferred - range.min + 1) % 3),
		);
	});

	it('fails clearly when a range is exhausted', async () => {
		await expect(
			allocatePort('/tmp/full', 'server', {
				range: { min: 1, max: 2 },
				isAvailable: async () => false,
			}),
		).rejects.toThrow('No free server port in 1-2.');
	});

	it('writes an atomic readable manifest', async () => {
		const directory = await mkdtemp(join(tmpdir(), 'hanabi-runtime-'));
		const target = join(directory, 'current.json');
		await writeManifest({ schemaVersion: 1, status: 'ready' }, target);

		expect(JSON.parse(await readFile(target, 'utf8'))).toEqual({
			schemaVersion: 1,
			status: 'ready',
		});
	});
});
