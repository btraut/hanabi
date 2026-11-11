import { chmod, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveCodexExecutable } from './codexExecutable.js';

const directories: string[] = [];
async function fixture() {
	const directory = await mkdtemp(join(tmpdir(), 'hanabi-codex-discovery-'));
	directories.push(directory);
	const pathBinary = join(directory, 'codex');
	const bundledBinary = join(directory, 'App Bundle', 'codex');
	await mkdir(join(directory, 'App Bundle'));
	for (const file of [pathBinary, bundledBinary]) {
		await writeFile(file, '#!/bin/sh\nexit 0\n');
		await chmod(file, 0o700);
	}
	return { directory, pathBinary, bundledBinary };
}
beforeEach(() => vi.stubEnv('HANABI_CODEX_PATH', undefined));
afterEach(async () => {
	vi.unstubAllEnvs();
	await Promise.all(
		directories.splice(0).map((path) => rm(path, { recursive: true, force: true })),
	);
});

describe('Codex executable discovery', () => {
	it('finds the bundled executable when the terminal PATH has no Codex', async () => {
		const { bundledBinary } = await fixture();
		await expect(
			resolveCodexExecutable({
				searchPath: '/nonexistent/hanabi-bin',
				bundledPaths: [bundledBinary],
			}),
		).resolves.toBe(bundledBinary);
	});

	it('prefers the terminal installation over the app bundle', async () => {
		const { directory, pathBinary, bundledBinary } = await fixture();
		await expect(
			resolveCodexExecutable({ searchPath: directory, bundledPaths: [bundledBinary] }),
		).resolves.toBe(pathBinary);
	});

	it('honors an explicit override and does not silently fall back when it is invalid', async () => {
		const { directory, bundledBinary } = await fixture();
		await expect(
			resolveCodexExecutable({ override: bundledBinary, searchPath: directory }),
		).resolves.toBe(bundledBinary);
		await expect(
			resolveCodexExecutable({
				override: join(directory, 'missing'),
				searchPath: directory,
				bundledPaths: [bundledBinary],
			}),
		).rejects.toThrow('Check HANABI_CODEX_PATH');
	});

	it('skips nonexecutable files and directories', async () => {
		const { directory, pathBinary, bundledBinary } = await fixture();
		await chmod(pathBinary, 0o600);
		await expect(
			resolveCodexExecutable({ searchPath: directory, bundledPaths: [directory, bundledBinary] }),
		).resolves.toBe(bundledBinary);
	});

	it('reports an actionable error when no installation exists', async () => {
		await expect(resolveCodexExecutable({ searchPath: '', bundledPaths: [] })).rejects.toThrow(
			'Install Codex or set HANABI_CODEX_PATH',
		);
	});
});
