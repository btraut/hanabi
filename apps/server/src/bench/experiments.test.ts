import * as fs from 'node:fs/promises';
import * as storage from './storage.js';
import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { hostname, tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseConfig } from './config.js';
import type { BenchObservation } from './engine.js';
import {
	parseRevision,
	runBenchmark,
	runClimb,
	summarize,
	type ClimbState,
} from './experiments.js';
import type { ModelConfig, ModelProvider, ModelRequest, ModelResponse } from './provider.js';
import type { GameResult } from './run.js';
import { readJson } from './storage.js';

vi.mock('node:fs/promises', async (importOriginal) => ({
	...(await importOriginal<typeof import('node:fs/promises')>()),
}));

const directories: string[] = [];
async function experimentDirectory(): Promise<string> {
	const parent = await mkdtemp(join(tmpdir(), 'hanabi-experiment-test-'));
	directories.push(parent);
	return join(parent, 'experiment');
}
afterEach(async () => {
	vi.restoreAllMocks();
	await Promise.all(
		directories.splice(0).map((path) => rm(path, { recursive: true, force: true })),
	);
});

interface PlayerInput {
	opportunity: string;
	observation: BenchObservation;
}
interface DreamerInput {
	currentVersion: { id: number; text: string };
	versions: Array<{ id: number; text: string }>;
	history: Array<{
		status: string;
		error?: string;
		playerLogs: unknown[];
		transcript: unknown;
		dreamerResponse: unknown;
	}>;
}

class ExperimentProvider implements ModelProvider {
	readonly playerRequests: ModelRequest[] = [];
	readonly dreamerRequests: ModelRequest[] = [];
	readonly gameStarts: ModelRequest[] = [];
	constructor(private readonly revisions: unknown[] = []) {}
	complete(_config: ModelConfig, request: ModelRequest): Promise<ModelResponse> {
		const properties = request.schema.properties as Record<string, unknown>;
		let value: unknown;
		if ('conventions' in properties) {
			this.dreamerRequests.push(structuredClone(request));
			value = this.revisions[this.dreamerRequests.length - 1] ?? {
				changed: false,
				conventions: null,
				explanation: 'Retain current agreements.',
			};
		} else {
			this.playerRequests.push(structuredClone(request));
			const prompt = JSON.parse(request.messages.at(-1)!.content) as PlayerInput;
			if (prompt.observation.turn === 0) this.gameStarts.push(structuredClone(request));
			value =
				prompt.opportunity === 'turn'
					? {
							actionId: prompt.observation.legalActions.find(
								({ action }) => action.type === 'play',
							)!.id,
							explanation: `PRIVATE ${prompt.observation.playerId} turn ${prompt.observation.turn}`,
						}
					: {
							reflection: `PRIVATE ${prompt.observation.playerId} result ${prompt.observation.turn}`,
						};
		}
		return Promise.resolve({ value, durationMs: 0 });
	}
}

function result(overrides: Partial<GameResult> = {}): GameResult {
	return {
		version: 1,
		status: 'completed',
		seed: 'seed',
		conventionsHash: 'hash',
		score: 25,
		maxScore: 25,
		perfect: true,
		finishedReason: 'Won',
		turns: 30,
		calls: 60,
		durationMs: 100,
		usage: { inputTokens: 10, outputTokens: 5, cachedInputTokens: 3 },
		usageReportedCalls: 1,
		...overrides,
	};
}

describe('benchmark runner', () => {
	it('uses matched seeds while keeping each configuration and its conventions fixed', async () => {
		const directory = await experimentDirectory();
		const provider = new ExperimentProvider();
		const configs = await Promise.all([
			parseConfig({ name: 'seeded', conventions: 'A FIXED CONVENTION' }),
			parseConfig({ name: 'rules-only', conventions: null }),
		]);
		const report = await runBenchmark({ directory, configs, seed: 'matched', games: 1, provider });
		expect(report.configurations.map(({ results }) => results[0].seed)).toEqual([
			'matched:0',
			'matched:0',
		]);
		expect(report.configurations.map(({ summary }) => summary.completed)).toEqual([1, 1]);
		expect(provider.dreamerRequests).toHaveLength(0);
		expect(provider.gameStarts).toHaveLength(2);
		const views = provider.gameStarts.map(
			(request) => (JSON.parse(request.messages[0].content) as PlayerInput).observation,
		);
		expect(views[0]).toEqual(views[1]);
		expect(provider.gameStarts[0].instructions).toContain('A FIXED CONVENTION');
		expect(provider.gameStarts[1].instructions).not.toContain('A FIXED CONVENTION');
		expect(await readFile(join(directory, 'games', '0000', '0000', 'conventions.md'), 'utf8')).toBe(
			'A FIXED CONVENTION',
		);
		expect(await readFile(join(directory, 'games', '0001', '0000', 'conventions.md'), 'utf8')).toBe(
			'',
		);
		expect(await readJson(join(directory, 'report.json'))).toEqual(report);
		expect(configs[0].conventions).toBe('A FIXED CONVENTION');
	});

	it('includes failed attempts in the primary perfect-rate denominator without averaging incomplete scores', () => {
		const summary = summarize([
			result(),
			result({ perfect: false, score: 20, finishedReason: 'OutOfTurns' }),
			result({ status: 'failed', perfect: false, score: 2, error: 'provider failed' }),
		]);
		expect(summary).toMatchObject({
			attempted: 3,
			completed: 2,
			failed: 1,
			perfect: 1,
			perfectGameRate: 1 / 3,
			completedPerfectGameRate: 0.5,
			averageScore: 22.5,
			inputTokens: 30,
			outputTokens: 15,
			cachedInputTokens: 9,
			calls: 180,
		});
		expect(summary.perfectRate95PercentInterval![0]).toBeLessThan(1 / 3);
		expect(summary.perfectRate95PercentInterval![1]).toBeGreaterThan(1 / 3);
		expect(summarize([])).toMatchObject({
			attempted: 0,
			perfectGameRate: null,
			averageScore: null,
			perfectRate95PercentInterval: null,
		});
	});

	it('rejects ambiguous names and invalid counts before starting any games', async () => {
		const directory = await experimentDirectory();
		const config = await parseConfig({});
		await expect(runBenchmark({ directory, configs: [config, config], games: 1 })).rejects.toThrow(
			'unique',
		);
		await expect(runBenchmark({ directory, configs: [config], games: 0 })).rejects.toThrow(
			'positive integer',
		);
		await expect(runBenchmark({ directory, configs: [], games: 1 })).rejects.toThrow(
			'at least one',
		);
	});
});

describe('convention hill climber', () => {
	it('immediately applies revisions to fresh players, preserves failed proposals, and resumes without replacing history', async () => {
		const directory = await experimentDirectory();
		const config = await parseConfig({ conventions: 'SEED AGREEMENT' });
		const provider = new ExperimentProvider([
			{
				changed: true,
				conventions: 'REVISION ONE',
				explanation: 'A concrete player misunderstanding calls for a broader convention rewrite.',
			},
			{ changed: true, conventions: 'MALFORMED REVISION' },
		]);
		const state = await runClimb({ directory, config, seed: 'lineage', games: 2, provider });
		expect(state.currentVersion).toBe(1);
		expect(state.versions.map(({ text }) => text)).toEqual(['SEED AGREEMENT', 'REVISION ONE']);
		expect(state.versions[1]).toMatchObject({
			parent: 0,
			iteration: 0,
		});
		expect(state.versions[1].explanation).toContain('misunderstanding');
		expect(await readFile(join(directory, 'iterations/0000/explanation.md'), 'utf8')).toBe(
			state.versions[1].explanation,
		);
		expect(state.iterations.map(({ conventionVersion }) => conventionVersion)).toEqual([0, 1]);
		expect(state.iterations.map(({ status }) => status)).toEqual(['completed', 'dreamer-failed']);
		expect(provider.gameStarts).toHaveLength(2);
		expect(provider.gameStarts.every(({ messages }) => messages.length === 1)).toBe(true);
		expect(provider.gameStarts[0].instructions).toContain('SEED AGREEMENT');
		expect(provider.gameStarts[1].instructions).toContain('REVISION ONE');
		expect(provider.gameStarts[1].instructions).not.toContain('misunderstanding');
		const secondDream = JSON.parse(provider.dreamerRequests[1].messages[0].content) as DreamerInput;
		expect(secondDream.history).toHaveLength(2);
		expect(secondDream.versions).toHaveLength(2);
		expect(secondDream.history[0].transcript).not.toBeNull();
		expect(JSON.stringify(secondDream.history[0].playerLogs)).toContain('PRIVATE player-1');
		const originalTranscript = await readFile(
			join(directory, 'iterations', '0000', 'game', 'transcript.json'),
			'utf8',
		);
		const resumedProvider = new ExperimentProvider();
		const resumed = await runClimb({
			directory,
			resume: true,
			games: 1,
			provider: resumedProvider,
		});
		expect(resumed.iterations).toHaveLength(3);
		expect(resumed.iterations.map(({ seed }) => seed)).toEqual([
			'lineage:0',
			'lineage:1',
			'lineage:2',
		]);
		expect(resumed.currentVersion).toBe(1);
		expect(resumed.versions).toHaveLength(2);
		expect(resumed.iterations[2]).toMatchObject({
			conventionVersion: 1,
			outputVersion: 1,
			status: 'completed',
		});
		expect(resumed.config).toEqual(config);
		expect(resumedProvider.gameStarts[0].messages).toHaveLength(1);
		expect(resumedProvider.gameStarts[0].instructions).toContain('REVISION ONE');
		const history = (
			JSON.parse(resumedProvider.dreamerRequests[0].messages[0].content) as DreamerInput
		).history;
		expect(history).toHaveLength(3);
		expect(history[1]).toMatchObject({
			status: 'dreamer-failed',
		});
		expect(history[1].error).toContain('Dreamer must return');
		expect(history[1].dreamerResponse).toMatchObject({
			value: { conventions: 'MALFORMED REVISION' },
		});
		expect(
			await readFile(join(directory, 'iterations', '0000', 'game', 'transcript.json'), 'utf8'),
		).toBe(originalTranscript);
		expect(await readFile(join(directory, 'versions', '0000.md'), 'utf8')).toBe('SEED AGREEMENT');
		expect(await readFile(join(directory, 'versions', '0001.md'), 'utf8')).toBe('REVISION ONE');
		expect(await readJson(join(directory, 'state.json'))).toEqual(resumed);
		await expect(runClimb({ directory, resume: true, config, games: 1 })).rejects.toThrow(
			'saved configuration',
		);
		await expect(runClimb({ directory, config, games: 1 })).rejects.toThrow('EEXIST');
	});

	it('retains a failed game in Dreamer history after a manual restart', async () => {
		const directory = await experimentDirectory();
		const first = await runClimb({
			directory,
			config: await parseConfig({}),
			seed: 'failed-game',
			games: 1,
			provider: { complete: () => Promise.reject(new Error('temporary provider failure')) },
		});
		expect(first.iterations[0].status).toBe('game-failed');
		expect(first.versions).toHaveLength(1);
		const provider = new ExperimentProvider();
		await runClimb({ directory, resume: true, games: 1, provider });
		const history = (JSON.parse(provider.dreamerRequests[0].messages[0].content) as DreamerInput)
			.history;
		expect(history[0]).toMatchObject({
			status: 'game-failed',
			error: 'temporary provider failure',
		});
		expect(history[0].transcript).not.toBeNull();
		expect(history[0].playerLogs).toEqual([null, null, null]);
	});

	it('rejects a concurrent resume while the first runner owns the lock', async () => {
		const directory = await experimentDirectory();
		let started!: () => void;
		const entered = new Promise<void>((resolve) => {
			started = resolve;
		});
		let release!: () => void;
		const pendingResponse = new Promise<ModelResponse>((_resolve, reject) => {
			release = () => reject(new Error('test released pending player'));
		});
		const running = runClimb({
			directory,
			config: await parseConfig({}),
			games: 1,
			provider: {
				complete: () => {
					started();
					return pendingResponse;
				},
			},
		});
		await entered;
		try {
			await expect(runClimb({ directory, resume: true, games: 1 })).rejects.toThrow(
				'already running',
			);
		} finally {
			release();
		}
		expect((await running).iterations[0].status).toBe('game-failed');
		expect(((await readJson(join(directory, 'state.json'))) as ClimbState).iterations).toHaveLength(
			1,
		);
	});

	it('never reclaims a stale lock, including simultaneous recovery attempts', async () => {
		const directory = await experimentDirectory();
		await mkdir(directory);
		const path = join(directory, '.running');
		const stale = JSON.stringify({ pid: 2147483647, host: hostname() });
		await writeFile(path, stale);
		const attempts = await Promise.allSettled(
			Array.from({ length: 2 }, () =>
				runClimb({ directory, resume: true, games: 1, provider: new ExperimentProvider() }),
			),
		);
		for (const attempt of attempts) {
			expect(attempt.status).toBe('rejected');
			if (attempt.status === 'rejected')
				expect(String(attempt.reason)).toContain('manually remove');
		}
		expect(await readFile(path, 'utf8')).toBe(stale);
	});

	it('closes and removes an owned lock when initializing its record fails', async () => {
		const directory = await experimentDirectory();
		const actualOpen = fs.open;
		let closed = false;
		vi.spyOn(fs, 'open').mockImplementationOnce(async (...args) => {
			const handle = await actualOpen(...args);
			const actualClose = handle.close.bind(handle);
			vi.spyOn(handle, 'close').mockImplementation(async () => {
				await actualClose();
				closed = true;
			});
			vi.spyOn(handle, 'writeFile').mockRejectedValueOnce(new Error('lock disk full'));
			return handle;
		});
		await expect(
			runClimb({
				directory,
				config: await parseConfig({}),
				games: 1,
				provider: new ExperimentProvider(),
			}),
		).rejects.toThrow('lock disk full');
		expect(closed).toBe(true);
		await expect(readFile(join(directory, '.running'))).rejects.toMatchObject({ code: 'ENOENT' });
		// Acquires a fresh lock, then fails because no manifest was written.
		await expect(
			runClimb({ directory, resume: true, games: 1, provider: new ExperimentProvider() }),
		).rejects.toThrow('state.json');
		await expect(readFile(join(directory, '.running'))).rejects.toMatchObject({ code: 'ENOENT' });
	});

	it('does not remove a replacement lock when releasing ownership', async () => {
		const directory = await experimentDirectory();
		const path = join(directory, '.running');
		await runClimb({
			directory,
			config: await parseConfig({}),
			games: 1,
			provider: {
				complete: async () => {
					await rename(path, `${path}.old`);
					await writeFile(path, 'another owner');
					throw new Error('stop');
				},
			},
		});
		expect(await readFile(path, 'utf8')).toBe('another owner');
	});

	it.each(['playing', 'reviewing'] as const)(
		'counts interrupted %s attempts without inventing result data',
		async (status) => {
			const directory = await experimentDirectory();
			const state = await runClimb({
				directory,
				config: await parseConfig({}),
				games: 1,
				seed: 'interrupt',
				provider: new ExperimentProvider(),
			});
			state.iterations[0].status = status;
			delete state.iterations[0].result;
			delete state.iterations[0].outputVersion;
			await rm(join(directory, 'iterations/0000/game/result.json'));
			await storage.writeJson(join(directory, 'state.json'), state);
			const provider = new ExperimentProvider();
			const resumed = await runClimb({ directory, resume: true, games: 1, provider });
			expect(resumed.iterations[0].result).toBeUndefined();
			const summary = summarize([resumed.iterations[1].result!], 1);
			expect(summary).toMatchObject({ attempted: 2, failed: 1, completed: 1 });
			expect(await readJson(join(directory, 'report.json'))).toMatchObject({ summary });
			expect(JSON.parse(provider.dreamerRequests[0].messages[0].content)).toMatchObject({
				summary,
			});
		},
	);

	it.each(['playing', 'reviewing'] as const)(
		'recovers a durable result after interruption while %s',
		async (status) => {
			const directory = await experimentDirectory();
			const state = await runClimb({
				directory,
				config: await parseConfig({}),
				games: 1,
				provider: new ExperimentProvider(),
			});
			const durable = state.iterations[0].result;
			state.iterations[0].status = status;
			delete state.iterations[0].result;
			delete state.iterations[0].outputVersion;
			await storage.writeJson(join(directory, 'state.json'), state);
			const resumed = await runClimb({
				directory,
				resume: true,
				games: 1,
				provider: new ExperimentProvider(),
			});
			expect(resumed.iterations[0]).toMatchObject({ status: 'dreamer-failed', result: durable });
			expect(await readJson(join(directory, 'report.json'))).toMatchObject({
				summary: { attempted: 2, completed: 2, failed: 0 },
			});
		},
	);

	it('recovers a durable failed game result missing from a terminal attempt', async () => {
		const directory = await experimentDirectory();
		const state = await runClimb({
			directory,
			config: await parseConfig({}),
			games: 1,
			provider: { complete: () => Promise.reject(new Error('model unavailable')) },
		});
		const durable = state.iterations[0].result;
		delete state.iterations[0].result;
		await storage.writeJson(join(directory, 'state.json'), state);
		const resumed = await runClimb({
			directory,
			resume: true,
			games: 1,
			provider: new ExperimentProvider(),
		});
		expect(resumed.iterations[0].result).toEqual(durable);
		expect(await readJson(join(directory, 'report.json'))).toMatchObject({
			summary: { attempted: 2, failed: 1, completed: 1 },
		});
	});

	it('rejects intentional changes to an immutable convention artifact', async () => {
		const directory = await experimentDirectory();
		await runClimb({
			directory,
			config: await parseConfig({}),
			games: 1,
			provider: new ExperimentProvider(),
		});
		await writeFile(join(directory, 'versions/0000.md'), 'modified');
		const provider = { complete: vi.fn() };
		await expect(runClimb({ directory, resume: true, games: 1, provider })).rejects.toThrow(
			'Convention artifact was modified',
		);
		expect(provider.complete).not.toHaveBeenCalled();
		expect(await readFile(join(directory, 'versions/0000.md'), 'utf8')).toBe('modified');
	});

	it('keeps completed adoption authoritative after a derived artifact fails and repairs it on resume', async () => {
		const directory = await experimentDirectory();
		const actualWrite = storage.writeText;
		vi.spyOn(storage, 'writeText').mockImplementation(async (path, text) => {
			if (path === join(directory, 'versions/0001.md')) throw new Error('derived disk full');
			await actualWrite(path, text);
		});
		await expect(
			runClimb({
				directory,
				config: await parseConfig({}),
				games: 1,
				provider: new ExperimentProvider([
					{ changed: true, conventions: 'ADOPTED', explanation: 'Use this next game.' },
				]),
			}),
		).rejects.toThrow('derived disk full');
		const committed = (await readJson(join(directory, 'state.json'))) as ClimbState;
		expect(committed.currentVersion).toBe(1);
		expect(committed.iterations[0]).toMatchObject({ status: 'completed', outputVersion: 1 });
		vi.restoreAllMocks();
		const resumed = await runClimb({
			directory,
			resume: true,
			games: 1,
			provider: new ExperimentProvider(),
		});
		expect(resumed.iterations[1].conventionVersion).toBe(1);
		expect(await readFile(join(directory, 'versions/0001.md'), 'utf8')).toBe('ADOPTED');
	});

	it('rejects malformed saved state before changing its bytes or calling a provider', async () => {
		const directory = await experimentDirectory();
		const state = await runClimb({
			directory,
			config: await parseConfig({}),
			games: 2,
			provider: new ExperimentProvider([
				{ changed: true, conventions: 'REVISION', explanation: 'Improve conventions.' },
			]),
		});
		const variants: Array<(saved: Record<string, unknown>) => void> = [
			(saved) => {
				saved.seed = 1;
			},
			(saved) => {
				saved.currentVersion = 'length';
			},
			(saved) => {
				saved.currentVersion = 0;
			},
			(saved) => {
				saved.versions = {};
			},
			(saved) => {
				saved.iterations = {};
			},
		];
		for (const [field, value] of [
			['id', 4],
			['parent', 9],
			['iteration', 99],
			['hash', 'wrong'],
			['text', 3],
			['explanation', null],
		]) {
			variants.push((saved) => {
				(saved.versions as Record<string, unknown>[])[1][field as string] = value;
			});
		}
		for (const [field, value] of [
			['index', 0],
			['index', 3],
			['status', 'invalid'],
			['status', ['completed']],
			['conventionVersion', 99],
			['outputVersion', 99],
			['result', {}],
		]) {
			variants.push((saved) => {
				(saved.iterations as Record<string, unknown>[])[1][field as string] = value;
			});
		}
		const provider = { complete: vi.fn() };
		for (const mutate of variants) {
			const saved = structuredClone(state) as unknown as Record<string, unknown>;
			mutate(saved);
			const bytes = JSON.stringify(saved);
			await writeFile(join(directory, 'state.json'), bytes);
			await expect(runClimb({ directory, resume: true, games: 1, provider })).rejects.toThrow();
			expect(await readFile(join(directory, 'state.json'), 'utf8')).toBe(bytes);
		}
		expect(provider.complete).not.toHaveBeenCalled();
	});

	it('requires resolved saved configuration without defaulting missing fields on resume', async () => {
		const directory = await experimentDirectory();
		const config = await parseConfig({
			name: 'two-player-scripted',
			players: [{ provider: 'scripted' }, { provider: 'scripted' }],
			dreamer: { provider: 'scripted' },
		});
		const state = await runClimb({
			directory,
			config,
			games: 1,
			provider: new ExperimentProvider(),
		});
		const paths = [
			['config'],
			...['name', 'game', 'players', 'conventions', 'dreamer', 'discussion'].map((field) => [
				'config',
				field,
			]),
			...['ruleSet', 'criticalGameOver', 'allowDragging'].map((field) => ['config', 'game', field]),
			...['provider', 'model', 'effort'].flatMap((field) => [
				['config', 'players', '0', field],
				['config', 'players', '1', field],
				['config', 'dreamer', field],
			]),
		];
		const provider = { complete: vi.fn() };
		for (const path of paths) {
			for (const missing of [true, false]) {
				const saved = structuredClone(state) as unknown as Record<string, unknown>;
				let target = saved;
				for (const key of path.slice(0, -1)) target = target[key] as Record<string, unknown>;
				if (missing) delete target[path.at(-1)!];
				else target[path.at(-1)!] = null;
				const bytes = JSON.stringify(saved);
				await writeFile(join(directory, 'state.json'), bytes);
				await expect(
					runClimb({ directory, resume: true, games: 1, provider }),
					`${path.join('.')} ${missing ? 'missing' : 'null'}`,
				).rejects.toThrow();
				expect(await readFile(join(directory, 'state.json'), 'utf8')).toBe(bytes);
			}
		}
		expect(provider.complete).not.toHaveBeenCalled();
		// ModelConfig permits omitted timeout/options; the required player identity remains fixed.
		for (const model of [...state.config.players, state.config.dreamer]) {
			delete model.timeoutMs;
			delete model.options;
		}
		await storage.writeJson(join(directory, 'state.json'), state);
		const resumed = await runClimb({
			directory,
			resume: true,
			games: 1,
			provider: new ExperimentProvider(),
		});
		expect(resumed.iterations).toHaveLength(2);
		expect(resumed.config.players).toHaveLength(2);
		expect(resumed.config.players.every((model) => model.provider === 'scripted')).toBe(true);
		expect(resumed.config.dreamer.provider).toBe('scripted');
	});

	it.each([
		null,
		{ changed: true, conventions: null, explanation: 'bad' },
		{ changed: false, conventions: 'not null', explanation: 'bad' },
		{ changed: true, conventions: 'new', explanation: '' },
		{ changed: 'yes', conventions: 'new', explanation: 'bad' },
		{ changed: true, conventions: 'new', explanation: 'fine', rules: 'replace rules' },
	])('rejects malformed revisions %j', (value) => {
		expect(() => parseRevision(value)).toThrow();
	});

	it('allows removal of all conventions and explicit no-change', () => {
		expect(
			parseRevision({ changed: true, conventions: '', explanation: 'Remove all conventions.' })
				.conventions,
		).toBe('');
		expect(
			parseRevision({
				changed: false,
				conventions: null,
				explanation: 'No coordination problem found.',
			}).changed,
		).toBe(false);
	});
});
