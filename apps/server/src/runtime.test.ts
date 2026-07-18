import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { AddressInfo } from 'node:net';
import { GameStore } from './games/server/GameStore.js';
import { createHanabiRuntime, HanabiRuntime } from './runtime.js';

const runtimes: HanabiRuntime[] = [];
const temporaryDirectories: string[] = [];

function createStore(overrides: Partial<GameStore> = {}): GameStore {
	return {
		saveGame: vi.fn().mockResolvedValue(undefined),
		deleteGame: vi.fn().mockResolvedValue(undefined),
		loadGameData: vi.fn().mockResolvedValue({}),
		close: vi.fn().mockResolvedValue(undefined),
		...overrides,
	};
}

async function createWebDist(): Promise<string> {
	const directory = await mkdtemp(path.join(tmpdir(), 'hanabi-runtime-test-'));
	temporaryDirectories.push(directory);
	await mkdir(path.join(directory, 'assets'));
	await writeFile(path.join(directory, 'index.html'), '<html>hanabi-spa</html>');
	await writeFile(path.join(directory, 'assets/app.js'), 'console.log("hanabi")');
	return directory;
}

afterEach(async () => {
	for (const runtime of runtimes.splice(0)) await runtime.close().catch(() => undefined);
	for (const directory of temporaryDirectories.splice(0)) {
		await rm(directory, { recursive: true, force: true });
	}
});

describe('createHanabiRuntime', () => {
	it('restores before readiness and serves production assets, deep routes, and Socket.IO', async () => {
		const runtime = createHanabiRuntime({
			nodeEnv: 'production',
			sessionCookieSecret: 'integration-test-secret-at-least-32-chars',
			gameStore: createStore(),
			webDistPath: await createWebDist(),
		});
		runtimes.push(runtime);
		await runtime.start(0, '127.0.0.1');
		const { port } = runtime.httpServer.address() as AddressInfo;
		const origin = `http://127.0.0.1:${port}`;

		const readiness = await fetch(`${origin}/api/readyz`);
		expect(readiness.status).toBe(200);
		await expect(readiness.json()).resolves.toEqual({ ready: true });

		const deepRoute = await fetch(`${origin}/game/abcdef`);
		expect(await deepRoute.text()).toContain('hanabi-spa');
		expect(deepRoute.headers.get('cache-control')).toBe('no-cache');

		const asset = await fetch(`${origin}/assets/app.js`);
		expect(asset.status).toBe(200);
		expect(asset.headers.get('cache-control')).toContain('immutable');

		const socketHandshake = await fetch(`${origin}/socket.io/?EIO=4&transport=polling`);
		expect(socketHandshake.status).toBe(200);
		expect(await socketHandshake.text()).toContain('sid');
	});

	it('never becomes ready when persisted-game restoration fails', async () => {
		const restoreError = new Error('restore failed');
		const runtime = createHanabiRuntime({
			nodeEnv: 'development',
			sessionCookieSecret: 'dev-secret',
			gameStore: createStore({ loadGameData: vi.fn().mockRejectedValue(restoreError) }),
			webDistPath: await createWebDist(),
		});

		await expect(runtime.start(0, '127.0.0.1')).rejects.toBe(restoreError);
		expect(runtime.ready).toBe(false);
	});
});
