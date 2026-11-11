import { constants } from 'node:fs';
import { access, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { delimiter, isAbsolute, join, resolve } from 'node:path';

const bundledExecutables =
	process.platform === 'darwin'
		? ['/Applications', join(homedir(), 'Applications')].map((directory) =>
				join(
					directory,
					'ChatGPT.app/Contents/Resources/codex-cli/CodexCLI.app/Contents/MacOS/codex',
				),
			)
		: [];

/** Resolve before entering the isolated inference directory; never invoke a shell. */
export async function resolveCodexExecutable({
	override = process.env.HANABI_CODEX_PATH,
	searchPath = process.env.PATH ?? '',
	bundledPaths = bundledExecutables,
}: {
	override?: string;
	searchPath?: string;
	bundledPaths?: readonly string[];
} = {}): Promise<string> {
	const name = override ?? 'codex';
	const hasPath = isAbsolute(name) || name.includes('/') || name.includes('\\');
	const candidates = hasPath
		? [resolve(name)]
		: searchPath
				.split(delimiter)
				.filter(Boolean)
				.map((directory) => resolve(directory, name));
	if (override === undefined) candidates.push(...bundledPaths);
	for (const candidate of candidates) {
		try {
			await access(candidate, constants.X_OK);
			if ((await stat(candidate)).isFile()) return candidate;
		} catch {
			// Missing or inaccessible candidates are not usable executables.
		}
	}
	throw new Error(
		override === undefined
			? 'Cannot launch local Codex: no executable found on PATH or in the ChatGPT app bundle. Install Codex or set HANABI_CODEX_PATH to its executable.'
			: `Cannot launch local Codex (${override}): executable not found or not executable. Check HANABI_CODEX_PATH or the configured executable.`,
	);
}
