import { createServer } from 'node:net';
import { EventEmitter } from 'node:events';
import { copyFile, mkdir, mkdtemp, readFile, realpath, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
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
	reportExistingRuntime,
	startServicesSequentially,
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
	it('waits for the server to become ready before starting the web app', async () => {
		const events: string[] = [];
		let markServerReady: (() => void) | undefined;
		const serverReady = new Promise<void>((resolve) => {
			markServerReady = resolve;
		});

		const servicesStarted = startServicesSequentially(
			async () => {
				events.push('server started');
				await serverReady;
				events.push('server ready');
				return 'server';
			},
			async () => {
				events.push('web started');
				return 'web';
			},
		);

		await Promise.resolve();
		expect(events).toEqual(['server started']);

		markServerReady?.();
		await expect(servicesStarted).resolves.toEqual({ server: 'server', web: 'web' });
		expect(events).toEqual(['server started', 'server ready', 'web started']);
	});

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
		).resolves.toEqual(activeLock);
		await expect(releaseLock('failed-second-run', target)).resolves.toBe(false);
		expect(JSON.parse(await readFile(target, 'utf8'))).toEqual(activeLock);
		await expect(releaseLock('active-run', target)).resolves.toBe(true);
	});

	it('allows exactly one simultaneous launcher to acquire a new lock', async () => {
		const directory = await mkdtemp(join(tmpdir(), 'hanabi-runtime-lock-'));
		const target = join(directory, 'lock.json');
		const results = await Promise.all(
			['first', 'second', 'third'].map((runId) => acquireLock(directory, runId, { target })),
		);
		const lock = JSON.parse(await readFile(target, 'utf8'));
		expect(results.filter((result) => result === null)).toHaveLength(1);
		expect(results.filter(Boolean)).toEqual([lock, lock]);
	});

	it('reclaims a dead launcher lock', async () => {
		const directory = await mkdtemp(join(tmpdir(), 'hanabi-runtime-lock-'));
		const target = join(directory, 'lock.json');
		await writeFile(target, JSON.stringify({ launcherPid: 123, runId: 'old' }));
		await expect(
			acquireLock(directory, 'new', { target, isRunning: () => false }),
		).resolves.toBeNull();
		expect(JSON.parse(await readFile(target, 'utf8')).runId).toBe('new');
	});

	it.each(['ready', 'starting'])(
		'exits the duplicate CLI successfully for a %s runtime',
		async (status) => {
			const directory = await realpath(await mkdtemp(join(tmpdir(), 'hanabi-runtime-cli-')));
			await mkdir(join(directory, 'scripts'));
			await mkdir(join(directory, '.context/dev'), { recursive: true });
			const script = join(directory, 'scripts/dev-runtime.mjs');
			await copyFile(new URL('./dev-runtime.mjs', import.meta.url), script);
			const lock = { runId: 'active', worktreeRoot: directory, launcherPid: process.pid };
			const manifest = {
				...lock,
				status,
				urls: { web: 'http://127.0.0.1:5200', server: 'http://127.0.0.1:3100' },
			};
			const target = join(directory, '.context/dev/current.json');
			const lockTarget = join(directory, '.context/dev/lock.json');
			await writeFile(lockTarget, JSON.stringify(lock));
			await writeManifest(manifest, target);

			const { stdout, stderr } = await promisify(execFile)(process.execPath, [script, 'start']);
			expect(stderr).toBe('');
			expect(stdout).toContain('Hanabi is already running for this worktree');
			expect(stdout).toContain(`PID ${process.pid}, ${status}`);
			expect(stdout).toContain(`Hanabi web: ${manifest.urls.web}`);
			expect(stdout).toContain(`Hanabi server: ${manifest.urls.server}`);
			expect(JSON.parse(await readFile(lockTarget, 'utf8'))).toEqual(lock);
			expect(JSON.parse(await readFile(target, 'utf8'))).toEqual(manifest);
		},
	);

	it('waits for a matching manifest before reporting URLs', async () => {
		const directory = await mkdtemp(join(tmpdir(), 'hanabi-runtime-'));
		const target = join(directory, 'current.json');
		const lock = { runId: 'new', worktreeRoot: directory, launcherPid: process.pid };
		const manifest = {
			...lock,
			status: 'starting',
			urls: { web: 'http://127.0.0.1:5200', server: 'http://127.0.0.1:3100' },
		};
		await writeManifest({ ...manifest, runId: 'old' }, target);
		const output: string[] = [];
		const reporting = reportExistingRuntime(lock, { target, log: (line) => output.push(line) });
		await writeManifest(manifest, target);
		await reporting;
		expect(output.join('\n')).toContain(manifest.urls.web);
		expect(output.join('\n')).toContain(manifest.urls.server);
	});

	it.each(['missing', 'stale'])(
		'reports startup without inventing URLs for a %s manifest',
		async (state) => {
			const directory = await mkdtemp(join(tmpdir(), 'hanabi-runtime-'));
			const target = join(directory, 'current.json');
			const lock = { runId: 'new', worktreeRoot: directory, launcherPid: process.pid };
			if (state === 'stale') {
				await writeManifest({ ...lock, runId: 'old', urls: { web: 'stale-url' } }, target);
			}
			const output: string[] = [];
			await reportExistingRuntime(lock, { target, timeoutMs: 0, log: (line) => output.push(line) });
			expect(output.join('\n')).toContain('already starting');
			expect(output.join('\n')).toContain('pnpm dev:status');
			expect(output.join('\n')).not.toContain('stale-url');
		},
	);

	it('reports an existing launcher that stopped or failed as an error', async () => {
		const directory = await mkdtemp(join(tmpdir(), 'hanabi-runtime-'));
		const target = join(directory, 'current.json');
		const lock = { runId: 'active', worktreeRoot: directory, launcherPid: process.pid };
		await expect(reportExistingRuntime(lock, { target, isRunning: () => false })).rejects.toThrow(
			'existing Hanabi launcher stopped',
		);
		await writeManifest({ ...lock, status: 'failed', error: 'server exited' }, target);
		await expect(reportExistingRuntime(lock, { target })).rejects.toThrow('server exited');
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
