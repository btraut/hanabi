import { createServer } from 'node:net';
import { EventEmitter } from 'node:events';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
	allocatePort,
	acquireLock,
	monitorChild,
	portRanges,
	preferredPort,
	releaseLock,
	reportRuntimeFailure,
	terminateChildren,
	waitForUrl,
	writeManifest,
} from './dev-runtime.mjs';

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

	it('aborts a hung readiness request at the overall deadline', async () => {
		let aborted = false;
		const hungFetch = (_url: string | URL | Request, options?: RequestInit) =>
			new Promise<Response>((_resolve, reject) => {
				options?.signal?.addEventListener('abort', () => {
					aborted = true;
					reject(new DOMException('aborted', 'AbortError'));
				});
			});

		await expect(waitForUrl('http://127.0.0.1:1', 10, undefined, hungFetch)).rejects.toThrow(
			'Timed out waiting for',
		);
		expect(aborted).toBe(true);
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

describe('development runtime lifecycle', () => {
	it('never removes a lock owned by another launcher', async () => {
		const directory = await mkdtemp(join(tmpdir(), 'hanabi-runtime-lock-'));
		const target = join(directory, 'lock.json');
		const activeLock = { runId: 'active-run', worktreeRoot: '/tmp/active', launcherPid: 123 };
		await writeFile(target, `${JSON.stringify(activeLock)}\n`, 'utf8');

		await expect(
			acquireLock('/tmp/active', 'failed-second-run', {
				target,
				isRunning: () => true,
			}),
		).rejects.toThrow('Hanabi is already running for this worktree (PID 123).');
		await expect(releaseLock('failed-second-run', target)).resolves.toBe(false);
		expect(JSON.parse(await readFile(target, 'utf8'))).toEqual(activeLock);
		await expect(releaseLock('active-run', target)).resolves.toBe(true);
	});

	it('records child spawn errors before running cleanup', async () => {
		const child = new EventEmitter();
		const manifest = { status: 'starting', error: null };
		const events: string[] = [];
		let cleanup: (() => void) | undefined;
		const cleanedUp = new Promise<void>((resolve) => {
			cleanup = resolve;
		});
		monitorChild(child, 'server', (message) => {
			void reportRuntimeFailure(
				manifest,
				message,
				async () => {
					events.push('cleanup');
					cleanup?.();
				},
				async () => {
					events.push('manifest');
				},
			);
		});

		child.emit('error', new Error('pnpm not found'));
		await cleanedUp;

		expect(manifest).toEqual({ status: 'failed', error: 'server failed to spawn: pnpm not found' });
		expect(events).toEqual(['manifest', 'cleanup']);
	});

	it('escalates from SIGTERM to SIGKILL when a child does not exit', async () => {
		const child = Object.assign(new EventEmitter(), {
			pid: 123,
			exitCode: null,
			signalCode: null,
			kill: () => true,
		});
		const signals: string[] = [];

		await terminateChildren([child], {
			graceMs: 1,
			killWaitMs: 10,
			killProcess: (_pid, signal) => {
				signals.push(signal);
				if (signal === 'SIGKILL') {
					child.signalCode = signal;
					child.emit('close');
				}
				return true;
			},
			platform: 'darwin',
		});

		expect(signals).toEqual(['SIGTERM', 'SIGKILL']);
	});
});
