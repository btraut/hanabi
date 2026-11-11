import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { parseConfig } from './config.js';
import { runClimb, type ClimbState } from './experiments.js';
import { ScriptedProvider } from './run.js';
import { readJson } from './storage.js';

const directories: string[] = [];
async function savedRun(): Promise<{ directory: string; statePath: string; state: ClimbState }> {
	const parent = await mkdtemp(join(tmpdir(), 'hanabi-compatibility-climb-'));
	directories.push(parent);
	const directory = join(parent, 'climb');
	await runClimb({
		directory,
		config: await parseConfig({}),
		seed: 'compatibility',
		games: 1,
		provider: new ScriptedProvider(),
	});
	const statePath = join(directory, 'state.json');
	return { directory, statePath, state: (await readJson(statePath)) as ClimbState };
}
afterEach(async () => {
	await Promise.all(
		directories.splice(0).map((path) => rm(path, { recursive: true, force: true })),
	);
});

describe('fixed-hand experiment compatibility', () => {
	it('resumes legacy manifests with the missing movement setting resolved to false', async () => {
		const { directory, statePath, state } = await savedRun();
		state.version = 1;
		delete (state.config.game as { allowDragging?: boolean }).allowDragging;
		await writeFile(statePath, JSON.stringify(state));
		const transcriptPath = join(directory, 'iterations', '0000', 'game', 'transcript.json');
		const original = await readFile(transcriptPath, 'utf8');
		const resumed = await runClimb({
			directory,
			resume: true,
			games: 1,
			provider: new ScriptedProvider(),
		});
		expect(resumed.config.game.allowDragging).toBe(false);
		expect(resumed.iterations.map((iteration) => iteration.status)).toEqual([
			'completed',
			'completed',
		]);
		expect(await readFile(transcriptPath, 'utf8')).toBe(original);
	});

	it.each(['missing', 'true'] as const)(
		'rejects a current manifest with %s movement setting before models or writes',
		async (setting) => {
			const { directory, statePath, state } = await savedRun();
			expect(state.version).toBe(2);
			const game = state.config.game as { allowDragging?: boolean };
			if (setting === 'missing') delete game.allowDragging;
			else game.allowDragging = true;
			const corrupted = JSON.stringify(state);
			await writeFile(statePath, corrupted);
			let calls = 0;
			await expect(
				runClimb({
					directory,
					resume: true,
					games: 1,
					provider: {
						complete() {
							calls++;
							throw new Error('Model must not be called.');
						},
					},
				}),
			).rejects.toThrow();
			expect(calls).toBe(0);
			expect(await readFile(statePath, 'utf8')).toBe(corrupted);
		},
	);
});
