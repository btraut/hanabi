import { access, mkdir, mkdtemp, readFile, readdir, realpath, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BenchGame, type BenchTranscript } from './engine.js';
import { readReviewSnapshot } from './reviewData.js';
import { writeJson, writeText } from './storage.js';

type Log = { turn: number; opportunity: string; response: Record<string, string> };

async function fixture(
	directory: string,
	options: { finish?: boolean; seed?: string; status?: 'failed' } = {},
) {
	const game = new BenchGame({
		seed: options.seed ?? directory,
		playerCount: 3,
		ruleSet: '5-color',
		criticalGameOver: true,
	});
	const logs: Record<string, Log[]> = {};
	if (options.finish !== false) {
		while (!game.finished) {
			const playerId = game.state.currentPlayerId!;
			const action = game.legalActions(playerId).find(({ action }) => action.type === 'play')!;
			const entries = (logs[playerId] ??= []);
			entries.push({
				turn: game.turn,
				opportunity: 'turn',
				response: { actionId: action.id, explanation: `Decision before turn ${game.turn + 1}.` },
			});
			game.apply(playerId, action.id);
			entries.push({
				turn: game.turn,
				opportunity: 'result',
				response: { reflection: `Reflection after turn ${game.turn}.` },
			});
		}
	}
	await mkdir(directory, { recursive: true });
	await writeJson(join(directory, 'transcript.json'), game.transcript());
	await writeJson(join(directory, 'config.json'), {
		players: Array.from({ length: 3 }, () => ({ model: 'gpt-6.1-sol', effort: 'high' })),
	});
	await writeText(
		join(directory, 'conventions.md'),
		'# Seed\n\nOldest unclued card is the default discard.\n',
	);
	for (const [playerId, entries] of Object.entries(logs))
		await writeJson(join(directory, 'private', `${playerId}.json`), entries);
	if (game.finished || options.status === 'failed')
		await writeJson(join(directory, 'result.json'), {
			status: options.status ?? 'completed',
			...(options.status === 'failed' ? { error: 'Provider failed before choosing a move.' } : {}),
		});
	return game;
}

async function contents(directory: string, prefix = ''): Promise<Record<string, string>> {
	const result: Record<string, string> = {};
	for (const entry of await readdir(join(directory, prefix), { withFileTypes: true })) {
		const path = join(prefix, entry.name);
		if (entry.isDirectory()) Object.assign(result, await contents(directory, path));
		else result[path] = await readFile(join(directory, path), 'utf8');
	}
	return result;
}

describe('Bench review artifact reader', () => {
	let directory: string;
	beforeEach(async () => {
		directory = await mkdtemp(join(tmpdir(), 'hanabi-review-data-'));
	});
	afterEach(async () => {
		await rm(directory, { recursive: true, force: true });
	});

	it('waits for an empty or not-yet-created run without creating artifacts', async () => {
		const missing = join(directory, 'future-run');
		for (const path of [directory, missing]) {
			expect(await readReviewSnapshot(path)).toEqual({
				source: path === directory ? await realpath(directory) : path,
				games: [],
				selectedGameId: null,
				game: null,
			});
		}
		await expect(access(missing)).rejects.toMatchObject({ code: 'ENOENT' });
		expect(await readdir(directory)).toEqual([]);
	});

	it('maps a direct game, model names, private decisions, and reflections without changing artifacts', async () => {
		const game = await fixture(directory);
		const before = await contents(directory);
		const snapshot = await readReviewSnapshot(directory);
		expect(snapshot.selectedGameId).toBe('.');
		expect(snapshot.games).toHaveLength(1);
		expect(snapshot.game).toMatchObject({
			id: '.',
			status: 'completed',
			maxScore: 25,
			error: null,
			dreamer: null,
		});
		expect(snapshot.game!.transcript.moves).toHaveLength(game.turn);
		expect(snapshot.game!.transcript.players[0].name).toBe('Player 1 · gpt-6.1-sol / high');
		expect(snapshot.game!.logs).toContainEqual({
			playerId: 'player-1',
			turn: 0,
			opportunity: 'turn',
			text: 'Decision before turn 1.',
		});
		expect(snapshot.game!.logs).toContainEqual({
			playerId: 'player-1',
			turn: 1,
			opportunity: 'result',
			text: 'Reflection after turn 1.',
		});
		expect(snapshot.game!.conventions).toContain('Oldest unclued');
		expect(await contents(directory)).toEqual(before);
	});

	it('reads pending decisions and late reflections independently of the transcript revision', async () => {
		const game = await fixture(directory, { finish: false });
		const action = game.legalActions('player-1').find(({ action }) => action.type === 'play')!;
		const logPath = join(directory, 'private', 'player-1.json');
		const entries: Log[] = [
			{
				turn: 0,
				opportunity: 'turn',
				response: { actionId: action.id, explanation: '<script>literal explanation</script>' },
			},
		];
		await writeJson(logPath, entries);
		const pending = await readReviewSnapshot(directory);
		expect(pending.game!.transcript.moves).toEqual([]);
		expect(pending.game!.logs).toEqual([
			{
				playerId: 'player-1',
				turn: 0,
				opportunity: 'turn',
				text: '<script>literal explanation</script>',
			},
		]);
		game.apply('player-1', action.id);
		await writeJson(join(directory, 'transcript.json'), game.transcript());
		const applied = await readReviewSnapshot(directory);
		expect(applied.game!.transcript.moves).toHaveLength(1);
		expect(applied.game!.logs).toHaveLength(1);
		entries.push({
			turn: 1,
			opportunity: 'result',
			response: { reflection: 'The revealed card changes my interpretation.' },
		});
		await writeJson(logPath, entries);
		const reflected = await readReviewSnapshot(directory);
		expect(reflected.game!.transcript).toEqual(applied.game!.transcript);
		expect(reflected.game!.logs).toHaveLength(2);
		expect(reflected.game!.logs[1]).toMatchObject({
			turn: 1,
			opportunity: 'result',
			text: 'The revealed card changes my interpretation.',
		});
	});

	it('selects the newest hill-climb iteration, supports pinning, and includes its Dreamer revision', async () => {
		await fixture(join(directory, 'iterations/0000/game'));
		await fixture(join(directory, 'iterations/0001/game'), { finish: false });
		await mkdir(join(directory, 'iterations/not-an-iteration'), { recursive: true });
		const revision = {
			changed: true,
			conventions: 'A complete replacement convention document.',
			explanation: 'The first clue was interpreted differently by the two players.',
		};
		await writeJson(join(directory, 'iterations/0000/revision.json'), revision);
		const latest = await readReviewSnapshot(directory);
		expect(latest.selectedGameId).toBe('iterations/0001/game');
		expect(latest.games.map(({ label }) => label)).toEqual(['Game 1', 'Game 2']);
		expect(latest.game!.status).toBe('playing');
		const before = await contents(directory);
		const pinned = await readReviewSnapshot(directory, 'iterations/0000/game');
		expect(pinned.game!.status).toBe('completed');
		expect(pinned.game!.dreamer).toEqual(revision);
		expect(await contents(directory)).toEqual(before);
		await mkdir(join(directory, 'iterations/0002'), { recursive: true });
		const waiting = await readReviewSnapshot(directory);
		expect(waiting.selectedGameId).toBe('iterations/0002/game');
		expect(waiting.game).toBeNull();
		expect(waiting.games.at(-1)).toMatchObject({ status: 'waiting', score: null, maxScore: null });
	});

	it('follows evaluation scheduling by game then configuration, while honoring a pinned earlier game', async () => {
		await fixture(join(directory, 'games/0000/0000'));
		await fixture(join(directory, 'games/0001/0000'));
		await fixture(join(directory, 'games/0000/0001'), { finish: false });
		await mkdir(join(directory, 'games/garbage/0009'), { recursive: true });
		const latest = await readReviewSnapshot(directory);
		expect(latest.games.map(({ id }) => id)).toEqual([
			'games/0000/0000',
			'games/0001/0000',
			'games/0000/0001',
		]);
		expect(latest.selectedGameId).toBe('games/0000/0001');
		expect(latest.game).toMatchObject({ status: 'playing', label: 'Configuration 1 · Game 2' });
		const pinned = await readReviewSnapshot(directory, 'games/0001/0000');
		expect(pinned.selectedGameId).toBe('games/0001/0000');
		expect(pinned.game).toMatchObject({ status: 'completed', label: 'Configuration 2 · Game 1' });
	});

	it('keeps zero-move provider failures reviewable without inventing a game ending', async () => {
		await fixture(directory, { finish: false, status: 'failed' });
		const snapshot = await readReviewSnapshot(directory);
		expect(snapshot.game).toMatchObject({
			status: 'failed',
			score: 0,
			error: 'Provider failed before choosing a move.',
		});
		expect(snapshot.game!.transcript.lifecycle.status).toBe('in_progress');
		expect(snapshot.game!.transcript.result).toBeUndefined();
		expect(snapshot.game!.transcript.moves).toEqual([]);
	});

	it('rejects traversal and unlisted game IDs without touching files', async () => {
		await fixture(directory);
		const before = await contents(directory);
		for (const id of [
			'..',
			'../outside',
			'/tmp',
			'private/player-1.json',
			'iterations/0000/game',
			'.%2e',
			'./',
		]) {
			await expect(readReviewSnapshot(directory, id)).rejects.toThrow('Unknown review game.');
		}
		expect(await contents(directory)).toEqual(before);
	});

	it('rejects an artifact-file symlink outside the selected root without exposing its contents', async () => {
		const chosen = join(directory, 'chosen-run');
		await fixture(chosen);
		const outside = join(directory, 'external-conventions.md');
		await writeText(outside, 'outside-root-secret');
		await rm(join(chosen, 'conventions.md'));
		await symlink(outside, join(chosen, 'conventions.md'));
		await expect(readReviewSnapshot(chosen)).rejects.toThrow();
		expect(await readFile(outside, 'utf8')).toBe('outside-root-secret');
	});

	it('rejects a game-directory symlink that escapes the selected experiment root', async () => {
		const chosen = join(directory, 'chosen-experiment');
		const external = join(directory, 'outside-game');
		await fixture(external);
		await mkdir(join(chosen, 'iterations/0000'), { recursive: true });
		await symlink(external, join(chosen, 'iterations/0000/game'), 'dir');
		const before = await contents(external);
		await expect(readReviewSnapshot(chosen)).rejects.toThrow();
		await expect(readReviewSnapshot(chosen, 'iterations/0000/game')).rejects.toThrow();
		expect(await contents(external)).toEqual(before);
	});

	it('allows artifact symlinks within the canonical root and an explicitly selected symlink root', async () => {
		const chosen = join(directory, 'chosen-run');
		await fixture(chosen);
		await writeText(join(chosen, 'saved/conventions.md'), 'In-root convention text.');
		await rm(join(chosen, 'conventions.md'));
		await symlink('saved/conventions.md', join(chosen, 'conventions.md'));
		expect((await readReviewSnapshot(chosen)).game!.conventions).toBe('In-root convention text.');
		const alias = join(directory, 'selected-alias');
		await symlink(chosen, alias, 'dir');
		const snapshot = await readReviewSnapshot(alias);
		expect(snapshot.game!.status).toBe('completed');
		expect(snapshot.game!.conventions).toBe('In-root convention text.');
	});

	it('rejects malformed private logs, contradictory Dreamer revisions, and tampered transcripts', async () => {
		const path = join(directory, 'iterations/0000/game');
		const game = await fixture(path, { finish: false });
		const logPath = join(path, 'private/player-1.json');
		for (const logs of [
			null,
			[{ turn: -1, opportunity: 'turn', response: { explanation: 'bad turn' } }],
			[{ turn: 0, opportunity: 'unknown', response: { reflection: 'bad opportunity' } }],
			[{ turn: 0, opportunity: 'turn', response: { reflection: 'missing explanation' } }],
		]) {
			await writeJson(logPath, logs);
			// null represents a missing optional artifact; malformed existing arrays are rejected.
			if (logs !== null) await expect(readReviewSnapshot(directory)).rejects.toThrow();
		}
		await writeJson(logPath, []);
		const revisionPath = join(directory, 'iterations/0000/revision.json');
		for (const revision of [
			{ changed: true, conventions: null, explanation: 'Missing replacement.' },
			{
				changed: false,
				conventions: 'Unexpected replacement.',
				explanation: 'Conflicting no-change response.',
			},
		]) {
			await writeJson(revisionPath, revision);
			await expect(readReviewSnapshot(directory)).rejects.toThrow();
		}
		await rm(revisionPath);
		const corrupt: BenchTranscript = game.transcript();
		corrupt.finalState.clues = -1;
		await writeJson(join(path, 'transcript.json'), corrupt);
		await expect(readReviewSnapshot(directory)).rejects.toThrow(/deterministic replay/);
	});
});
