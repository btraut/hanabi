import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HANABI_RULE_SETS } from '@hanabi/shared';
import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_CONVENTIONS, loadConfig, parseConfig } from './config.js';

const directories: string[] = [];

async function temporaryDirectory() {
	const directory = await mkdtemp(join(tmpdir(), 'hanabi-config-'));
	directories.push(directory);
	return directory;
}

afterEach(async () => {
	await Promise.all(
		directories.splice(0).map((path) => rm(path, { recursive: true, force: true })),
	);
});

describe('Hanabi Bench configuration', () => {
	it('defaults to three local Sol high players with independent settings and minimal conventions', async () => {
		const config = await parseConfig({});
		expect(config.game).toEqual({
			ruleSet: '5-color',
			criticalGameOver: true,
			allowDragging: false,
		});
		expect(config.players).toHaveLength(3);
		expect(config.players[0]).toEqual({
			provider: 'codex',
			model: 'gpt-6.1-sol',
			effort: 'high',
			timeoutMs: 300_000,
		});
		expect(config.conventions).toBe(DEFAULT_CONVENTIONS);
		expect(config.discussion).toBe(false);
		config.players[0].model = 'different-model';
		expect(config.players[1].model).toBe('gpt-6.1-sol');
		expect(config.dreamer.model).toBe('gpt-6.1-sol');
		expect((await parseConfig({})).players[0].model).toBe('gpt-6.1-sol');
	});

	it.each(HANABI_RULE_SETS)('supports variant %s and per-seat model settings', async (ruleSet) => {
		const config = await parseConfig({
			name: 'mixed-efforts',
			game: { ruleSet, criticalGameOver: true },
			players: [
				{ provider: 'codex', model: 'gpt-6.1-sol', effort: 'low' },
				{
					provider: 'codex',
					model: 'gpt-6-astra',
					effort: 'high',
					timeoutMs: 120_000,
					options: { modelVerbosity: 'high', serviceTier: 'priority' },
				},
			],
			dreamer: { provider: 'scripted' },
			discussion: true,
		});
		expect(config.game).toEqual({ ruleSet, criticalGameOver: true, allowDragging: false });
		expect(config.players.map((player) => player.effort)).toEqual(['low', 'high']);
		expect(config.players[1].options).toEqual({ modelVerbosity: 'high', serviceTier: 'priority' });
		expect(config.dreamer.provider).toBe('scripted');
		expect(config.discussion).toBe(true);
	});

	it.each([2, 3, 4, 5])('accepts %i seats', async (count) => {
		const config = await parseConfig({ players: Array.from({ length: count }, () => ({})) });
		expect(config.players).toHaveLength(count);
	});

	it.each([null, ''])('supports an explicit rules-only condition: %s', async (conventions) => {
		expect((await parseConfig({ conventions })).conventions).toBe('');
	});

	it('preserves arbitrary convention prose without a prescribed template', async () => {
		const conventions = 'Our convention: invent names freely.\n\nUnicode: 🃏\n';
		expect((await parseConfig({ conventions })).conventions).toBe(conventions);
	});

	it('resolves convention files relative to the config file, not the process directory', async () => {
		const directory = await temporaryDirectory();
		await mkdir(join(directory, 'configs'));
		await writeFile(join(directory, 'starter.md'), 'Custom seed.\n');
		await writeFile(
			join(directory, 'configs', 'run.json'),
			JSON.stringify({ conventionsFile: '../starter.md' }),
		);
		expect((await loadConfig(join(directory, 'configs', 'run.json'))).conventions).toBe(
			'Custom seed.\n',
		);
	});

	it.each([
		[null, 'config must be an object'],
		[[], 'config must be an object'],
		[{ typo: true }, 'Unknown config field'],
		[{ name: '' }, 'name must be a nonempty string'],
		[{ game: null }, 'game must be an object'],
		[{ game: { movement: true } }, 'Unknown game field'],
		[{ game: { allowDragging: 'false' } }, 'game.allowDragging'],
		[{ game: { allowDragging: null } }, 'game.allowDragging'],
		[{ game: { allowDragging: true } }, 'tile movement is not supported'],
		[{ game: { ruleSet: 'rainbows' } }, 'game.ruleSet'],
		[{ game: { criticalGameOver: 'false' } }, 'game.criticalGameOver'],
		[{ players: 'three' }, 'players must be an array'],
		[{ players: [] }, 'players must be an array'],
		[{ players: [{}] }, 'players must be an array'],
		[{ players: [{}, {}, {}, {}, {}, {}] }, 'players must be an array'],
		[{ players: [null, {}] }, 'players[0] must be an object'],
		[{ players: [{ vendor: 'openai' }, {}] }, 'Unknown players[0] field'],
		[{ players: [{ provider: 'opus' }, {}] }, 'players[0].provider'],
		[{ players: [{ model: '' }, {}] }, 'players[0].model'],
		[{ players: [{ effort: 'ultra' }, {}] }, 'players[0].effort'],
		[{ players: [{ timeoutMs: 2_147_483_648 }, {}] }, 'players[0].timeoutMs'],
		[{ players: [{ effort: 'lots' }, {}] }, 'players[0].effort'],
		[{ players: [{ timeoutMs: 0 }, {}] }, 'players[0].timeoutMs'],
		[{ players: [{ timeoutMs: 1.5 }, {}] }, 'players[0].timeoutMs'],
		[{ players: [{ timeoutMs: '1000' }, {}] }, 'players[0].timeoutMs'],
		[{ players: [{ options: null }, {}] }, 'players[0].options'],
		[{ players: [{ options: { command: 'cat secrets' } }, {}] }, 'Unknown players[0].options'],
		[{ players: [{ options: { modelVerbosity: ['high'] } }, {}] }, 'modelVerbosity'],
		[{ players: [{ options: { serviceTier: 'unknown' } }, {}] }, 'serviceTier'],
		[{ dreamer: { effort: false } }, 'dreamer.effort'],
		[{ discussion: 'yes' }, 'discussion must be a boolean'],
		[{ conventions: 123 }, 'conventions must be a string'],
		[{ conventionsFile: '' }, 'conventionsFile must be a nonempty string'],
		[{ conventions: null, conventionsFile: 'seed.md' }, 'not both'],
	])('rejects invalid configuration %j', async (value, message) => {
		await expect(parseConfig(value)).rejects.toThrow(String(message));
	});

	it('accepts an explicit false movement setting for saved configurations', async () => {
		expect((await parseConfig({ game: { allowDragging: false } })).game.allowDragging).toBe(false);
	});

	it.each([1, 2_147_483_647])('accepts timeout boundary %s', async (timeoutMs) => {
		expect((await parseConfig({ players: [{ timeoutMs }, {}] })).players[0].timeoutMs).toBe(
			timeoutMs,
		);
	});

	it('reports malformed JSON with its filename', async () => {
		const directory = await temporaryDirectory();
		const filename = join(directory, 'broken.json');
		await writeFile(filename, '{');
		await expect(loadConfig(filename)).rejects.toThrow(`Invalid JSON in config ${filename}`);
	});

	it('fails when a referenced conventions file is missing', async () => {
		const directory = await temporaryDirectory();
		await expect(parseConfig({ conventionsFile: 'missing.md' }, directory)).rejects.toThrow(
			'ENOENT',
		);
	});

	it.each(['sol-high.json', 'sol-high-rules-only.json', 'scripted.json'])(
		'loads the checked-in example %s',
		async (name) => {
			const filename = fileURLToPath(new URL(`../../../../bench/configs/${name}`, import.meta.url));
			const config = await loadConfig(filename);
			expect(config.players).toHaveLength(3);
			expect(config.conventions).toBe(name.includes('rules-only') ? '' : DEFAULT_CONVENTIONS);
		},
	);
});
