import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { isHanabiRuleSet, type HanabiRuleSet } from '@hanabi/shared';
import { MAX_TIMEOUT_MS, type ModelConfig } from './provider.js';

export interface BenchConfig {
	name: string;
	game: { ruleSet: HanabiRuleSet; criticalGameOver: boolean; allowDragging: false };
	players: ModelConfig[];
	conventions: string;
	dreamer: ModelConfig;
	discussion: boolean;
}

export const DEFAULT_CONVENTIONS = `# Starter conventions

A clue can signal that a touched card should be played immediately.

The default discard is the oldest unclued card in your hand.
`;

/** The local Codex model identifier is "sol", not the spoken spelling "Soul". */
export function defaultModelConfig(): ModelConfig {
	return { provider: 'codex', model: 'gpt-6.1-sol', effort: 'high', timeoutMs: 300_000 };
}

export const DEFAULT_CONFIG: BenchConfig = {
	name: 'three-player-sol-high',
	game: { ruleSet: '5-color', criticalGameOver: true, allowDragging: false },
	players: Array.from({ length: 3 }, defaultModelConfig),
	conventions: DEFAULT_CONVENTIONS,
	dreamer: defaultModelConfig(),
	discussion: false,
};

function object(value: unknown, label: string): Record<string, unknown> {
	if (value === null || typeof value !== 'object' || Array.isArray(value)) {
		throw new Error(`${label} must be an object.`);
	}
	return value as Record<string, unknown>;
}

function keys(value: Record<string, unknown>, allowed: readonly string[], label: string): void {
	for (const key of Object.keys(value)) {
		if (!allowed.includes(key)) throw new Error(`Unknown ${label} field: ${key}.`);
	}
}

function string(value: unknown, label: string): string {
	if (typeof value !== 'string' || value.trim().length === 0) {
		throw new Error(`${label} must be a nonempty string.`);
	}
	return value;
}

function boolean(value: unknown, label: string): boolean {
	if (typeof value !== 'boolean') throw new Error(`${label} must be a boolean.`);
	return value;
}

function model(value: unknown, label: string): ModelConfig {
	const input = object(value, label);
	keys(input, ['provider', 'model', 'effort', 'timeoutMs', 'options'], label);
	const defaults = defaultModelConfig();
	const provider = input.provider === undefined ? defaults.provider : input.provider;
	if (provider !== 'codex' && provider !== 'scripted') {
		throw new Error(`${label}.provider must be "codex" or "scripted".`);
	}
	const effort = input.effort === undefined ? defaults.effort : input.effort;
	if (
		typeof effort !== 'string' ||
		!['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max', 'ultra'].includes(effort)
	) {
		throw new Error(`${label}.effort is not a recognized reasoning effort.`);
	}
	if (provider === 'codex' && effort === 'ultra')
		throw new Error(
			`${label}.effort ultra requires delegation and is unavailable for tool-free Codex.`,
		);
	const timeoutMs = input.timeoutMs === undefined ? defaults.timeoutMs! : input.timeoutMs;
	if (
		typeof timeoutMs !== 'number' ||
		!Number.isSafeInteger(timeoutMs) ||
		timeoutMs <= 0 ||
		timeoutMs > MAX_TIMEOUT_MS
	) {
		throw new Error(`${label}.timeoutMs must be an integer from 1 to ${MAX_TIMEOUT_MS}.`);
	}
	let options: Record<string, unknown> | undefined;
	if (input.options !== undefined) {
		const raw = object(input.options, `${label}.options`);
		keys(raw, ['modelVerbosity', 'serviceTier'], `${label}.options`);
		if (
			raw.modelVerbosity !== undefined &&
			(typeof raw.modelVerbosity !== 'string' ||
				!['low', 'medium', 'high'].includes(raw.modelVerbosity))
		) {
			throw new Error(`${label}.options.modelVerbosity must be low, medium, or high.`);
		}
		if (
			raw.serviceTier !== undefined &&
			(typeof raw.serviceTier !== 'string' ||
				!['default', 'priority', 'flex'].includes(raw.serviceTier))
		) {
			throw new Error(`${label}.options.serviceTier must be default, priority, or flex.`);
		}
		options = { ...raw };
	}
	return {
		provider,
		model: string(
			input.model === undefined
				? provider === 'scripted'
					? 'scripted'
					: defaults.model
				: input.model,
			`${label}.model`,
		),
		effort,
		timeoutMs,
		...(options === undefined ? {} : { options }),
	};
}

/** Resolve a configuration completely before starting games or invoking a model. */
export async function parseConfig(value: unknown, baseDir = process.cwd()): Promise<BenchConfig> {
	const input = object(value, 'config');
	keys(
		input,
		['name', 'game', 'players', 'conventions', 'conventionsFile', 'dreamer', 'discussion'],
		'config',
	);
	const game = input.game === undefined ? {} : object(input.game, 'game');
	keys(game, ['ruleSet', 'criticalGameOver', 'allowDragging'], 'game');
	if (game.allowDragging !== undefined && game.allowDragging !== false)
		throw new Error('game.allowDragging must be false; tile movement is not supported.');
	const ruleSet = game.ruleSet === undefined ? '5-color' : game.ruleSet;
	if (!isHanabiRuleSet(ruleSet)) throw new Error('game.ruleSet is not a supported Hanabi variant.');
	const rawPlayers = input.players === undefined ? DEFAULT_CONFIG.players : input.players;
	if (!Array.isArray(rawPlayers) || rawPlayers.length < 2 || rawPlayers.length > 5) {
		throw new Error('players must be an array of two through five model configurations.');
	}
	const players = rawPlayers.map((player: unknown, index) => model(player, `players[${index}]`));
	const dreamer = model(
		input.dreamer === undefined ? defaultModelConfig() : input.dreamer,
		'dreamer',
	);
	if (Object.hasOwn(input, 'conventions') && Object.hasOwn(input, 'conventionsFile')) {
		throw new Error('Specify conventions or conventionsFile, not both.');
	}
	let conventions = DEFAULT_CONVENTIONS;
	if (Object.hasOwn(input, 'conventions')) {
		if (input.conventions !== null && typeof input.conventions !== 'string') {
			throw new Error('conventions must be a string or null (rules only).');
		}
		conventions = input.conventions ?? '';
	} else if (Object.hasOwn(input, 'conventionsFile')) {
		const filename = resolve(baseDir, string(input.conventionsFile, 'conventionsFile'));
		conventions = await readFile(filename, 'utf8');
	}
	return {
		name: input.name === undefined ? DEFAULT_CONFIG.name : string(input.name, 'name'),
		game: {
			ruleSet,
			allowDragging: false,
			criticalGameOver:
				game.criticalGameOver === undefined
					? true
					: boolean(game.criticalGameOver, 'game.criticalGameOver'),
		},
		players,
		conventions,
		dreamer,
		discussion: input.discussion === undefined ? false : boolean(input.discussion, 'discussion'),
	};
}

export async function loadConfig(path: string): Promise<BenchConfig> {
	const filename = resolve(path);
	const text = await readFile(filename, 'utf8');
	let value: unknown;
	try {
		value = JSON.parse(text) as unknown;
	} catch (error) {
		throw new Error(`Invalid JSON in config ${filename}.`, { cause: error });
	}
	return parseConfig(value, dirname(filename));
}
