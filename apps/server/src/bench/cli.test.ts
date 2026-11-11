import { execFile } from 'node:child_process';
import { access, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BenchGame, type BenchObservation, type BenchTranscript } from './engine.js';
import type { BenchmarkReport, ClimbState } from './experiments.js';
import type { GameResult } from './run.js';

const root = fileURLToPath(new URL('../../../../', import.meta.url));
const launcher = join(root, 'scripts/hanabi-bench.mjs');

interface CommandResult {
	code: number;
	stdout: string;
	stderr: string;
}

function run(
	args: string[],
	input = '',
	env: NodeJS.ProcessEnv = {},
	cwd = root,
): Promise<CommandResult> {
	return new Promise((resolve, reject) => {
		const child = execFile(
			process.execPath,
			[launcher, ...args],
			{ cwd, env: { ...process.env, ...env }, timeout: 20_000, maxBuffer: 10 * 1024 * 1024 },
			(error, stdout, stderr) => {
				if (error?.killed) reject(new Error(`CLI timed out: ${stderr}`));
				else
					resolve({
						code: error ? (typeof error.code === 'number' ? error.code : -1) : 0,
						stdout,
						stderr,
					});
			},
		);
		child.stdin!.on('error', () => {
			/* Early failures can close stdin before consuming it. */
		});
		child.stdin!.end(input);
	});
}

async function json<T>(path: string): Promise<T> {
	return JSON.parse(await readFile(path, 'utf8')) as T;
}

function lastOutput<T>(result: CommandResult): T {
	return JSON.parse(result.stdout.trim().split('\n').at(-1)!) as T;
}

describe('Hanabi Bench CLI subprocess integration', () => {
	let directory: string;
	let config: string;

	beforeEach(async () => {
		directory = await mkdtemp(join(tmpdir(), 'hanabi-bench-cli-test-'));
		config = join(directory, 'scripted.json');
		await writeFile(
			config,
			JSON.stringify({
				name: 'scripted-cli',
				game: { allowDragging: false, criticalGameOver: false },
				players: Array.from({ length: 3 }, () => ({ provider: 'scripted' })),
				dreamer: { provider: 'scripted' },
			}),
		);
	});

	afterEach(async () => {
		await rm(directory, { recursive: true, force: true });
	});

	it('prints help and complete variant rules without creating run artifacts', async () => {
		const help = await run(['--help']);
		expect(help.code, help.stderr).toBe(0);
		expect(help.stdout).toContain('pnpm bench climb --resume');
		expect(help.stdout).toContain('local authenticated Codex');
		expect(help.stdout).toContain('pnpm bench review PATH [--port N] [--no-open]');
		expect(help.stdout).toContain('[--watch]');
		const rules = await run([
			'rules',
			'--players',
			'5',
			'--rules',
			'rainbow-black-powder',
			'--critical-game-over',
		]);
		expect(rules.code, rules.stderr).toBe(0);
		expect(rules.stdout).toContain('5-player');
		expect(rules.stdout).toContain('Rainbow cards match every allowed color clue');
		expect(rules.stdout).toContain('Black Powder cards match rank clues only');
		expect(rules.stdout).toContain('Critical game over is enabled');
		expect(await readdir(directory)).toEqual(['scripted.json']);
	}, 20_000);

	it('accepts JSON moves, reports invalid lines without changing state, and verifies saved replay', async () => {
		const out = join(directory, 'manual');
		const expected = new BenchGame({
			seed: 'cli-manual',
			playerCount: 3,
			ruleSet: '5-color',
			criticalGameOver: true,
			allowDragging: false,
		});
		const clue = expected.legalActions('player-1').find(({ action }) => action.type === 'clue')!;
		expected.apply('player-1', clue.id);
		const discard = expected
			.legalActions('player-2')
			.find(({ action }) => action.type === 'discard')!;
		expected.apply('player-2', discard.id);
		const input = [
			JSON.stringify({ playerId: 'player-2', actionId: clue.id }),
			'{invalid json',
			JSON.stringify({ playerId: 'player-1', actionId: clue.id }),
			JSON.stringify({ playerId: 'player-2', actionId: 'missing' }),
			JSON.stringify({ playerId: 'player-2', actionId: discard.id }),
			'quit',
			'',
		].join('\n');
		const result = await run(['play', '--json', '--seed', 'cli-manual', '--out', out], input);
		expect(result.code, result.stderr).toBe(0);
		const messages = result.stdout
			.trim()
			.split('\n')
			.map((line) => JSON.parse(line) as { type: string; observation?: BenchObservation });
		expect(messages.map((message) => message.type)).toEqual([
			'rules',
			'observation',
			'error',
			'error',
			'observation',
			'error',
			'observation',
		]);
		const initial = messages[1].observation!;
		expect(
			initial.hands
				.find((hand) => hand.playerId === 'player-1')!
				.cards.every((card) => card.face === null),
		).toBe(true);
		expect(messages.at(-1)!.observation!.turn).toBe(2);
		expect(await json<BenchTranscript>(join(out, 'transcript.json'))).toEqual(
			expected.transcript(),
		);
		const replay = await run(['replay', join(out, 'transcript.json')]);
		expect(replay.code, replay.stderr).toBe(0);
		expect(lastOutput(replay)).toMatchObject({ verified: true, turns: 2, finished: false });
		const tampered = expected.transcript();
		tampered.events[0].postTurn.clues = -1;
		const tamperedPath = join(directory, 'tampered.json');
		await writeFile(tamperedPath, JSON.stringify(tampered));
		const rejected = await run(['replay', tamperedPath]);
		expect(rejected.code).toBe(1);
		expect(rejected.stderr).toContain('does not match deterministic replay');
	}, 20_000);

	it('rejects rearrangement commands without changing the fixed hand order', async () => {
		const out = join(directory, 'movement-rejected');
		const layout = {
			orderedRow: ['card-10', 'card-9', 'card-8', 'card-7', 'card-6'],
			lowerArea: [],
		};
		const input = [
			JSON.stringify({ playerId: 'player-2', arrangement: layout }),
			JSON.stringify({ playerId: 'player-1', actionId: 'action-0', arrangement: null }),
			`arrange player-2 ${JSON.stringify(layout)}`,
			'quit',
			'',
		].join('\n');
		const result = await run(['play', '--json', '--out', out], input);
		expect(result.code, result.stderr).toBe(0);
		const messages = result.stdout
			.trim()
			.split('\n')
			.map((line) => JSON.parse(line) as { type: string; observation?: BenchObservation });
		expect(messages.filter(({ type }) => type === 'error')).toHaveLength(3);
		for (const hand of messages[1].observation!.hands) {
			expect(hand).not.toHaveProperty('layout');
			expect(hand).not.toHaveProperty('positions');
		}
		expect((await json<BenchTranscript>(join(out, 'transcript.json'))).events).toEqual([]);
	});

	it('rejects movement transcripts explicitly and replays version 1 transcripts', async () => {
		const legacy = new BenchGame({
			seed: 'legacy-v1',
			playerCount: 3,
			ruleSet: '5-color',
			criticalGameOver: false,
		});
		legacy.apply('player-1', 'action-0');
		const path = join(directory, 'legacy.json');
		await writeFile(path, JSON.stringify(legacy.transcript()));
		const replay = await run(['replay', path]);
		expect(replay.code, replay.stderr).toBe(0);
		expect(lastOutput(replay)).toMatchObject({ verified: true, turns: 1 });
		const movementPath = join(directory, 'movement.json');
		await writeFile(movementPath, JSON.stringify({ ...legacy.transcript(), version: 2 }));
		const rejected = await run(['replay', movementPath]);
		expect(rejected.code).toBe(1);
		expect(rejected.stderr).toContain('only version 1 games without tile movement can be replayed');
	}, 20_000);

	it('supports human-readable action commands through the same engine', async () => {
		const out = join(directory, 'human');
		const result = await run(['play', '--seed', 'cli-human', '--out', out], 'play card-1\nquit\n');
		expect(result.code, result.stderr).toBe(0);
		expect(result.stdout).toContain('card-1=?');
		expect(result.stdout).toContain('Turn 1');
		const transcript = await json<BenchTranscript>(join(out, 'transcript.json'));
		expect(transcript.events).toHaveLength(1);
		expect(transcript.events[0].action).toEqual({ type: 'play', tileId: 'card-1' });
	});

	it('runs a complete offline game, records private logs, and replays the result', async () => {
		const out = join(directory, 'run');
		const result = await run(['run', '--config', config, '--seed', 'cli-run', '--out', out]);
		expect(result.code, result.stderr).toBe(0);
		const summary = lastOutput<GameResult & { directory: string }>(result);
		expect(summary).toMatchObject({
			directory: out,
			status: 'completed',
			seed: 'cli-run',
			score: 0,
			perfect: false,
		});
		expect(summary.turns).toBeGreaterThan(30);
		expect(summary.calls).toBe(summary.turns * 2);
		expect(await json<GameResult>(join(out, 'result.json'))).toMatchObject({
			status: 'completed',
			calls: summary.calls,
		});
		const logs = await json<Array<{ opportunity: string }>>(join(out, 'private/player-1.json'));
		expect(logs.some((entry) => entry.opportunity === 'turn')).toBe(true);
		expect(logs.some((entry) => entry.opportunity === 'result')).toBe(true);
		const replay = await run(['replay', join(out, 'transcript.json')]);
		expect(replay.code, replay.stderr).toBe(0);
		expect(lastOutput(replay)).toMatchObject({
			verified: true,
			turns: summary.turns,
			finished: true,
			score: 0,
		});
	}, 20_000);

	it('evaluates multiple named configurations on matching deals with independent summaries', async () => {
		const out = join(directory, 'eval');
		const rulesOnly = join(directory, 'rules-only.json');
		const raw = await json<Record<string, unknown>>(config);
		await writeFile(
			rulesOnly,
			JSON.stringify({ ...raw, name: 'scripted-rules-only', conventions: null }),
		);
		const result = await run([
			'eval',
			'--config',
			config,
			'--config',
			rulesOnly,
			'--games',
			'1',
			'--seed',
			'cli-eval',
			'--out',
			out,
		]);
		expect(result.code, result.stderr).toBe(0);
		const report = await json<BenchmarkReport>(join(out, 'report.json'));
		expect(report.configurations).toHaveLength(2);
		expect(report.requestedGamesPerConfig).toBe(1);
		for (const entry of report.configurations) {
			expect(entry.summary).toMatchObject({
				attempted: 1,
				completed: 1,
				failed: 0,
				perfect: 0,
				perfectGameRate: 0,
				averageScore: 0,
			});
			expect(entry.results[0].seed).toBe('cli-eval:0');
		}
		expect(report.configurations[0].results[0].conventionsHash).not.toBe(
			report.configurations[1].results[0].conventionsHash,
		);
		expect(lastOutput<{ configurations: unknown[] }>(result).configurations).toHaveLength(2);
	}, 20_000);

	it('climbs one game, saves Dreamer evidence, then manually resumes for one fresh game', async () => {
		const out = join(directory, 'climb');
		const first = await run([
			'climb',
			'--config',
			config,
			'--games',
			'1',
			'--seed',
			'cli-climb',
			'--out',
			out,
		]);
		expect(first.code, first.stderr).toBe(0);
		expect(lastOutput(first)).toEqual({ directory: out, iterations: 1, currentVersion: 0 });
		const before = await json<ClimbState>(join(out, 'state.json'));
		expect(before.iterations).toHaveLength(1);
		expect(before.iterations[0]).toMatchObject({
			status: 'completed',
			seed: 'cli-climb:0',
			conventionVersion: 0,
		});
		expect(await json(join(out, 'iterations/0000/revision.json'))).toMatchObject({
			changed: false,
			conventions: null,
		});
		const firstGame = await readFile(join(out, 'iterations/0000/game/transcript.json'), 'utf8');
		const resumed = await run(['climb', '--resume', out, '--games', '1']);
		expect(resumed.code, resumed.stderr).toBe(0);
		expect(lastOutput(resumed)).toEqual({ directory: out, iterations: 2, currentVersion: 0 });
		const after = await json<ClimbState>(join(out, 'state.json'));
		expect(after.iterations).toHaveLength(2);
		expect(after.iterations[1]).toMatchObject({
			status: 'completed',
			seed: 'cli-climb:1',
			conventionVersion: 0,
		});
		expect(after.config).toEqual(before.config);
		expect(after.versions).toEqual(before.versions);
		expect(await readFile(join(out, 'iterations/0000/game/transcript.json'), 'utf8')).toBe(
			firstGame,
		);
		const request = await json<{ messages: Array<{ content: string }> }>(
			join(out, 'iterations/0001/dreamer-request.json'),
		);
		const evidence = JSON.parse(request.messages[0].content) as { history: unknown[] };
		expect(evidence.history).toHaveLength(2);
		await expect(access(join(out, '.running'))).rejects.toMatchObject({ code: 'ENOENT' });
	}, 20_000);

	it('rejects invalid flags, counts, configuration, and duplicate names before creating output', async () => {
		const invalidConfig = join(directory, 'invalid.json');
		await writeFile(invalidConfig, JSON.stringify({ unexpected: true }));
		const cases = [
			['run', '--config', config, '--games', '1'],
			['run', '--config', config, '--unknown'],
			['run', '--config', config, 'unexpected-position'],
			['eval', '--config', config, '--games', '0'],
			['eval', '--config', config, '--games', '1.5'],
			['play', '--players', '6'],
			['play', '--no-movement'],
			['play', '--rules', 'invalid'],
			['run', '--seed', ''],
			['run', '--config', invalidConfig],
			['run', '--config', config, '--config', config],
			['eval', '--config', config, '--config', config],
			['climb', '--resume', directory],
		];
		for (const [index, args] of cases.entries()) {
			const out = join(directory, `invalid-${index}`);
			const result = await run([...args, '--out', out]);
			expect(result.code, `${args.join(' ')}: ${result.stderr}`).toBe(1);
			await expect(access(out)).rejects.toMatchObject({ code: 'ENOENT' });
		}
	}, 30_000);

	it('rejects invalid viewer options before artifacts, frontend builds, or models', async () => {
		const cases = [
			['review'],
			['review', ''],
			['review', directory, 'extra'],
			['review', directory, '--watch'],
			['review', directory, '--port', '0'],
			['review', directory, '--port', '65536'],
			['review', directory, '--port', '1.5'],
			['review', directory, '--port', 'garbage'],
			['run', '--no-open'],
			['run', '--port', '1234'],
			['climb', '--no-open'],
			['climb', '--watch', '--games', '0'],
			['climb', '--watch', '--resume', directory, '--config', config],
			['eval', '--watch'],
			['play', '--watch'],
		];
		for (const args of cases) {
			const result = await run(args, '', { PATH: directory }, directory);
			expect(result.code, `${args.join(' ')}: ${result.stderr}`).toBe(1);
			expect(result.stderr).not.toContain('Review:');
		}
		expect(await readdir(directory)).toEqual(['scripted.json']);
	}, 30_000);

	it('requires an existing review directory before loading the frontend', async () => {
		const missing = await run(['review', join(directory, 'missing'), '--no-open']);
		expect(missing.code).toBe(1);
		expect(missing.stderr).toContain('ENOENT');
		const file = await run(['review', config, '--no-open']);
		expect(file.code).toBe(1);
		expect(file.stderr).toContain('Review path must be a directory');
		expect(await readdir(directory)).toEqual(['scripted.json']);
	});

	it.each(['constructor', 'toString', '__proto__'])(
		'rejects inherited command %s before artifacts or models',
		async (command) => {
			const result = await run([command], '', { PATH: directory }, directory);
			expect(result.code).toBe(1);
			expect(result.stderr).toContain('Unknown command');
			expect(await readdir(directory)).toEqual(['scripted.json']);
		},
	);

	it.each(['', '   '])('rejects blank resume %j before artifacts or models', async (resume) => {
		const result = await run(['climb', '--resume', resume], '', { PATH: directory }, directory);
		expect(result.code).toBe(1);
		expect(result.stderr).toContain('--resume must not be empty');
		expect(await readdir(directory)).toEqual(['scripted.json']);
	});

	it('rejects an explicitly empty incompatible output flag on resume', async () => {
		const result = await run(
			['climb', '--resume', directory, '--out', ''],
			'',
			{ PATH: directory },
			directory,
		);
		expect(result.code).toBe(1);
		expect(result.stderr).toContain('--resume uses the saved');
		expect(await readdir(directory)).toEqual(['scripted.json']);
	});

	it('exits with failure when saving an accepted manual action fails', async () => {
		const inject = join(directory, 'fail-save.cjs');
		await writeFile(
			inject,
			`const fs = require('node:fs/promises');
const original = fs.writeFile;
let saves = 0;
fs.writeFile = async function(path, ...args) {
  if (String(path).includes('transcript.json.') && ++saves === 2) throw new Error('injected transcript write failure');
  return original.call(this, path, ...args);
};
require('node:module').syncBuiltinESMExports();
`,
		);
		const out = join(directory, 'save-failure');
		const result = await run(
			['play', '--json', '--seed', 'save-failure', '--out', out],
			'play card-1\nquit\n',
			{ NODE_OPTIONS: `--require=${inject}` },
		);
		expect(result.code, result.stderr).toBe(1);
		expect(result.stderr).toContain('injected transcript write failure');
		const messages = result.stdout
			.trim()
			.split('\n')
			.map((line) => JSON.parse(line) as { type: string });
		expect(messages.map(({ type }) => type)).toEqual(['rules', 'observation']);
		expect((await json<BenchTranscript>(join(out, 'transcript.json'))).events).toHaveLength(0);
	});

	it('refuses to overwrite an existing run directory', async () => {
		const before = await readFile(config, 'utf8');
		const result = await run(['run', '--config', config, '--out', directory]);
		expect(result.code).toBe(1);
		expect(result.stderr).toContain('EEXIST');
		expect(await readdir(directory)).toEqual(['scripted.json']);
		expect(await readFile(config, 'utf8')).toBe(before);
	});

	it('returns a failure exit and durable result when local Codex cannot launch', async () => {
		const out = join(directory, 'failed-run');
		// No real model or credentials are touched: the child cannot find a Codex executable.
		const result = await run(['run', '--seed', 'cli-failure', '--out', out], '', {
			PATH: directory,
			HANABI_CODEX_PATH: join(directory, 'missing-codex'),
		});
		expect(result.code, result.stderr).toBe(1);
		const summary = lastOutput<GameResult>(result);
		expect(summary).toMatchObject({ status: 'failed', turns: 0, calls: 1, perfect: false });
		expect(summary.error).toContain('Cannot launch local Codex');
		expect(await json<GameResult>(join(out, 'result.json'))).toMatchObject({
			status: 'failed',
			turns: 0,
		});
		expect((await json<BenchTranscript>(join(out, 'transcript.json'))).events).toEqual([]);
	});
});
