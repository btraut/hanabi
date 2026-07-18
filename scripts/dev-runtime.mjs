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
const SHUTDOWN_GRACE_MS = 5_000;
const SHUTDOWN_KILL_WAIT_MS = 1_000;

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

export async function acquireLock(worktreeRoot, runId, options = {}) {
	const target = options.target ?? lockPath;
	const isRunning = options.isRunning ?? processIsRunning;
	await mkdir(dirname(target), { recursive: true });
	try {
		await access(target, constants.F_OK);
		const lock = await readJson(target);
		if (lock.worktreeRoot === worktreeRoot && isRunning(lock.launcherPid)) {
			throw new Error(`Hanabi is already running for this worktree (PID ${lock.launcherPid}).`);
		}
		await rm(target, { force: true });
	} catch (error) {
		if (error?.code !== 'ENOENT') throw error;
	}

	await writeFile(
		target,
		`${JSON.stringify({ runId, worktreeRoot, launcherPid: process.pid }, null, 2)}\n`,
		{ encoding: 'utf8', flag: 'wx' },
	);
}

export async function releaseLock(runId, target = lockPath) {
	try {
		const lock = await readJson(target);
		if (lock.runId !== runId) return false;
		await rm(target, { force: true });
		return true;
	} catch (error) {
		if (error?.code === 'ENOENT') return false;
		throw error;
	}
}

export async function waitForUrl(url, timeoutMs = 60_000, signal, fetchImpl = fetch) {
	const deadline = Date.now() + timeoutMs;
	let lastError;
	while (Date.now() < deadline) {
		if (signal?.aborted) throw new Error(`Stopped waiting for ${url}.`);
		const requestController = new AbortController();
		const abortRequest = () => requestController.abort();
		signal?.addEventListener('abort', abortRequest, { once: true });
		const requestTimeout = setTimeout(
			abortRequest,
			Math.max(1, Math.min(5_000, deadline - Date.now())),
		);
		try {
			const response = await fetchImpl(url, { signal: requestController.signal });
			if (response.ok) return;
			lastError = new Error(`${url} returned ${response.status}`);
		} catch (error) {
			lastError = error;
		} finally {
			clearTimeout(requestTimeout);
			signal?.removeEventListener('abort', abortRequest);
		}
		if (Date.now() < deadline) {
			await new Promise((resolveWait) =>
				setTimeout(resolveWait, Math.min(300, deadline - Date.now())),
			);
		}
	}
	throw new Error(`Timed out waiting for ${url}: ${lastError?.message ?? 'not reachable'}`);
}

function childHasExited(child) {
	return !child || child.pid == null || child.exitCode !== null || child.signalCode !== null;
}

function waitForChildExit(child) {
	if (childHasExited(child)) return Promise.resolve();
	return new Promise((resolveExit) => child.once('close', resolveExit));
}

function signalChild(child, signal, options = {}) {
	if (childHasExited(child)) return;
	const platform = options.platform ?? process.platform;
	const killProcess = options.killProcess ?? process.kill.bind(process);
	try {
		if (platform !== 'win32' && child.pid) killProcess(-child.pid, signal);
		else child.kill(signal);
	} catch {
		child.kill(signal);
	}
}

async function waitAtMost(promise, timeoutMs) {
	let timeoutToken;
	try {
		await Promise.race([
			promise,
			new Promise((resolveTimeout) => {
				timeoutToken = setTimeout(resolveTimeout, timeoutMs);
			}),
		]);
	} finally {
		clearTimeout(timeoutToken);
	}
}

export async function terminateChildren(children, options = {}) {
	const graceMs = options.graceMs ?? SHUTDOWN_GRACE_MS;
	const killWaitMs = options.killWaitMs ?? SHUTDOWN_KILL_WAIT_MS;
	for (const child of children) signalChild(child, 'SIGTERM', options);
	await waitAtMost(Promise.all(children.map(waitForChildExit)), graceMs);

	const stuckChildren = children.filter((child) => !childHasExited(child));
	for (const child of stuckChildren) signalChild(child, 'SIGKILL', options);
	await waitAtMost(Promise.all(stuckChildren.map(waitForChildExit)), killWaitMs);
}

export function monitorChild(child, name, onFailure) {
	child.once('error', (error) => {
		onFailure(`${name} failed to spawn: ${error instanceof Error ? error.message : String(error)}`);
	});
	child.once('exit', (code, signal) => {
		onFailure(`${name} exited before shutdown (${signal ?? code ?? 'unknown'}).`);
	});
}

export async function reportRuntimeFailure(manifest, message, shutdown, write = writeManifest) {
	manifest.status = 'failed';
	manifest.error = message;
	try {
		await write(manifest);
	} finally {
		await shutdown(1, true);
	}
}

export async function start() {
	const worktreeRoot = await realpath(repoRoot);
	const runId = randomUUID();
	await acquireLock(worktreeRoot, runId);
	let server = null;
	let web = null;
	let manifest = null;
	let shuttingDown = false;
	let failureReported = false;
	const readinessAbortController = new AbortController();
	const shutdown = async (exitCode = 0, keepManifest = false) => {
		if (shuttingDown) return;
		shuttingDown = true;
		readinessAbortController.abort();
		try {
			await terminateChildren([server, web]);
		} finally {
			await releaseLock(runId);
			if (!keepManifest) await rm(manifestPath, { force: true });
			process.exitCode = exitCode;
		}
	};
	for (const signal of ['SIGINT', 'SIGTERM']) {
		process.once(signal, () => void shutdown(0));
	}

	try {
		const reserved = new Set();
		const serverPort = await allocatePort(worktreeRoot, 'server', { reserved });
		reserved.add(serverPort);
		const webPort = await allocatePort(worktreeRoot, 'web', { reserved });
		const urls = {
			server: `http://127.0.0.1:${serverPort}`,
			web: `http://127.0.0.1:${webPort}`,
		};
		manifest = {
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
		const reportChildFailure = (message) => {
			if (shuttingDown || failureReported) return;
			failureReported = true;
			void reportRuntimeFailure(manifest, message, shutdown).catch((error) =>
				console.error(error instanceof Error ? error.message : error),
			);
		};

		server = spawn('pnpm', ['--dir', 'apps/server', 'dev'], spawnOptions);
		monitorChild(server, 'server', reportChildFailure);
		web = spawn('pnpm', ['--dir', 'apps/web', 'dev'], spawnOptions);
		monitorChild(web, 'web', reportChildFailure);
		manifest.services.server.pid = server.pid ?? null;
		manifest.services.web.pid = web.pid ?? null;
		await writeManifest(manifest);

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
		if (!shuttingDown) {
			if (manifest) {
				await reportRuntimeFailure(
					manifest,
					error instanceof Error ? error.message : String(error),
					shutdown,
				);
			} else {
				await shutdown(1, true);
			}
		}
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
		console.error(error instanceof Error ? error.message : error);
		process.exitCode = 1;
	});
}
