import * as fs from 'node:fs/promises';
import { mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { writeText } from './storage.js';

vi.mock('node:fs/promises', async (importOriginal) => ({
	...(await importOriginal<typeof import('node:fs/promises')>()),
}));

const directories: string[] = [];
afterEach(async () => {
	vi.restoreAllMocks();
	await Promise.all(
		directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
	);
});

describe('atomic artifact text writes', () => {
	it.each([false, true])('never publishes a partial write (existing=%s)', async (existing) => {
		const directory = await mkdtemp(join(tmpdir(), 'hanabi-storage-test-'));
		directories.push(directory);
		const target = join(directory, 'version.md');
		if (existing) await writeFile(target, 'previous complete text');
		const actualWrite = fs.writeFile;
		vi.spyOn(fs, 'writeFile').mockImplementationOnce(async (path, _data, options) => {
			await actualWrite(path, 'partial', options);
			throw new Error('disk full');
		});
		await expect(writeText(target, 'complete revision')).rejects.toThrow('disk full');
		if (existing) expect(await readFile(target, 'utf8')).toBe('previous complete text');
		else await expect(readFile(target)).rejects.toMatchObject({ code: 'ENOENT' });
		expect(await readdir(directory)).toEqual(existing ? ['version.md'] : []);
		await writeText(target, 'complete revision');
		expect(await readFile(target, 'utf8')).toBe('complete revision');
		expect((await stat(target)).mode & 0o777).toBe(0o600);
	});
});
