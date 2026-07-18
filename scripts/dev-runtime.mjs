import { createHash, randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { access, mkdir, readFile, realpath, rename, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
export const repoRoot = resolve(scriptDirectory, '..');
export const runtimeDirectory = resolve(repoRoot, '.context/dev');
export const manifestPath = resolve(runtimeDirectory, 'current.json');
export const lockPath = resolve(runtimeDirectory, 'lock.json');

export const portRanges = {
	server: { min: 3000, max: 3199 },
	web: { min: 5173, max: 5372 },
};

export function preferredPort(worktreeRoot, service, range = portRanges[service]) {
	const digest = createHash('sha256').update(`${worktreeRoot}:${service}`).digest();
	return range.min + (digest.readUInt32BE(0) % (range.max - range.min + 1));
}

export async function canListen(port, host = '127.0.0.1') {
	return new Promise((resolveAvailability) => {
		const server = createServer();
		server.unref();
		server.once('error', () => resolveAvailability(false));
		server.listen({ host, port, exclusive: true }, () => {
			server.close(() => resolveAvailability(true));
		});
	});
}

export async function allocatePort(worktreeRoot, service, options = {}) {
	const range = options.range ?? portRanges[service];
	const reserved = options.reserved ?? new Set();
	const isAvailable = options.isAvailable ?? canListen;
	const preferred = preferredPort(worktreeRoot, service, range);
	const size = range.max - range.min + 1;

	for (let offset = 0; offset < size; offset += 1) {
		const candidate = range.min + ((preferred - range.min + offset) % size);
		if (!reserved.has(candidate) && (await isAvailable(candidate))) {
			return candidate;
		}
	}

	throw new Error(`No free ${service} port in ${range.min}-${range.max}.`);
}

export async function writeManifest(manifest, target = manifestPath) {
	await mkdir(dirname(target), { recursive: true });
	const temporaryPath = `${target}.${process.pid}.${randomUUID()}.tmp`;
	await writeFile(temporaryPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
	await rename(temporaryPath, target);
}

async function readJson(path) {
	return JSON.parse(await readFile(path, 'utf8'));
}

function processIsRunning(pid) {
	try {
		process.kill(pid, 0);
		return true;
	} catch {
		return false;
	}
}

async function acquireLock(worktreeRoot, runId) {
	await mkdir(runtimeDirectory, { recursive: true });
	try {
		await access(lockPath, constants.F_OK);
		const lock = await readJson(lockPath);
		if (lock.worktreeRoot === worktreeRoot && processIsRunning(lock.launcherPid)) {
			throw new Error(`Hanabi is already running for this worktree (PID ${lock.launcherPid}).`);
		}
		await rm(lockPath, { force: true });
	} catch (error) {
		if (error?.code !== 'ENOENT') throw error;
	}

	await writeFile(
		lockPath,
		`${JSON.stringify({ runId, worktreeRoot, launcherPid: process.pid }, null, 2)}\n`,
		{ encoding: 'utf8', flag: 'wx' },
	);
}

async function waitForUrl(url, timeoutMs = 60_000, signal) {
	const deadline = Date.now() + timeoutMs;
	let lastError;
	while (Date.now() < deadline) {
		if (signal?.aborted) throw new Error(`Stopped waiting for ${url}.`);
		try {
			const response = await fetch(url, { signal });
			if (response.ok) return;
			lastError = new Error(`${url} returned ${response.status}`);
		} catch (error) {
			lastError = error;
		}
		await new Promise((resolveWait) => setTimeout(resolveWait, 300));
	}
	throw new Error(`Timed out waiting for ${url}: ${lastError?.message ?? 'not reachable'}`);
}

function waitForChildExit(child) {
	if (!child || child.exitCode !== null || child.signalCode !== null) return Promise.resolve();
	return new Promise((resolveExit) => child.once('exit', resolveExit));
}

function terminate(child) {
	if (!child || child.exitCode !== null || child.signalCode !== null) return;
	try {
		if (process.platform !== 'win32' && child.pid) process.kill(-child.pid, 'SIGTERM');
		else child.kill('SIGTERM');
	} catch {
		child.kill('SIGTERM');
	}
}

export async function start() {
	const worktreeRoot = await realpath(repoRoot);
	const runId = randomUUID();
	await acquireLock(worktreeRoot, runId);
	let server = null;
	let web = null;
	let shuttingDown = false;
	const readinessAbortController = new AbortController();
	const shutdown = async (exitCode = 0, keepManifest = false) => {
		if (shuttingDown) return;
		shuttingDown = true;
		readinessAbortController.abort();
		terminate(server);
		terminate(web);
		await Promise.all([waitForChildExit(server), waitForChildExit(web)]);
		await rm(lockPath, { force: true });
		if (!keepManifest) await rm(manifestPath, { force: true });
		process.exitCode = exitCode;
	};
	for (const signal of ['SIGINT', 'SIGTERM']) {
		process.once(signal, () => void shutdown(0));
	}

	const reserved = new Set();
	const serverPort = await allocatePort(worktreeRoot, 'server', { reserved });
	reserved.add(serverPort);
	const webPort = await allocatePort(worktreeRoot, 'web', { reserved });
	const urls = {
		server: `http://127.0.0.1:${serverPort}`,
		web: `http://127.0.0.1:${webPort}`,
	};
	const manifest = {
		schemaVersion: 1,
		runId,
		status: 'starting',
		worktreeRoot,
		launcherPid: process.pid,
		startedAt: new Date().toISOString(),
		ports: { web: webPort, server: serverPort },
		urls,
		services: {
			web: { pid: null, ready: false },
			server: { pid: null, ready: false },
		},
		error: null,
	};
	if (shuttingDown) return;
	await writeManifest(manifest);
	if (shuttingDown) return;

	const environment = {
		...process.env,
		PORT: String(serverPort),
		HANABI_DEV_WEB_PORT: String(webPort),
		HANABI_DEV_SERVER_URL: urls.server,
	};
	const spawnOptions = {
		cwd: worktreeRoot,
		env: environment,
		stdio: 'inherit',
		detached: process.platform !== 'win32',
	};
	server = spawn('pnpm', ['--dir', 'apps/server', 'dev'], spawnOptions);
	web = spawn('pnpm', ['--dir', 'apps/web', 'dev'], spawnOptions);
	manifest.services.server.pid = server.pid ?? null;
	manifest.services.web.pid = web.pid ?? null;
	await writeManifest(manifest);

	for (const [name, child] of [
		['server', server],
		['web', web],
	]) {
		child.once('exit', (code, signal) => {
			if (shuttingDown) return;
			manifest.status = 'failed';
			manifest.error = `${name} exited before shutdown (${signal ?? code ?? 'unknown'}).`;
			void writeManifest(manifest).finally(() => shutdown(1, true));
		});
	}

	try {
		await Promise.all([
			waitForUrl(`${urls.server}/api/readyz`, 60_000, readinessAbortController.signal),
			waitForUrl(urls.web, 60_000, readinessAbortController.signal),
		]);
		manifest.status = 'ready';
		manifest.services.server.ready = true;
		manifest.services.web.ready = true;
		await writeManifest(manifest);
		console.log(`Hanabi web: ${urls.web}`);
		console.log(`Hanabi server: ${urls.server}`);
		await Promise.all([waitForChildExit(server), waitForChildExit(web)]);
	} catch (error) {
		if (shuttingDown) return;
		manifest.status = 'failed';
		manifest.error = error instanceof Error ? error.message : String(error);
		await writeManifest(manifest);
		await shutdown(1, true);
		throw error;
	}
}

export async function status(json = false) {
	const manifest = await readJson(manifestPath);
	const result = {
		...manifest,
		launcherRunning: processIsRunning(manifest.launcherPid),
	};
	if (json) console.log(JSON.stringify(result));
	else console.log(`${result.status}: ${result.urls.web} (launcher ${result.launcherPid})`);
	return result;
}

export async function down() {
	const manifest = await readJson(manifestPath);
	if (!processIsRunning(manifest.launcherPid)) {
		throw new Error(`Hanabi launcher ${manifest.launcherPid} is not running.`);
	}
	process.kill(manifest.launcherPid, 'SIGTERM');
}

async function main() {
	const command = process.argv[2] ?? 'start';
	if (command === 'start') await start();
	else if (command === 'status') await status(process.argv.includes('--json'));
	else if (command === 'down') await down();
	else throw new Error(`Unknown dev runtime command: ${command}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
	main().catch(async (error) => {
		await rm(lockPath, { force: true });
		console.error(error instanceof Error ? error.message : error);
		process.exitCode = 1;
	});
}
