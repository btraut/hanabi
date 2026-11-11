import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

export async function writeJson(path: string, value: unknown): Promise<void> {
	await writeText(path, `${JSON.stringify(value, null, 2)}\n`);
}

export async function readJson(path: string): Promise<unknown> {
	return JSON.parse(await readFile(path, 'utf8')) as unknown;
}

export async function createRunDirectory(path: string): Promise<void> {
	await mkdir(dirname(path), { recursive: true });
	// Never overwrite an existing run, even if it was interrupted.
	await mkdir(path, { mode: 0o700 });
}

export function conventionHash(text: string): string {
	return createHash('sha256').update(text).digest('hex');
}

export async function writeText(path: string, text: string): Promise<void> {
	await mkdir(dirname(path), { recursive: true });
	const temporary = `${path}.${randomUUID()}.tmp`;
	try {
		await writeFile(temporary, text, { mode: 0o600, flag: 'wx' });
		await rename(temporary, path);
	} finally {
		await rm(temporary, { force: true }).catch(() => {});
	}
}

export function numberedPath(directory: string, index: number): string {
	return join(directory, String(index).padStart(4, '0'));
}

export function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
