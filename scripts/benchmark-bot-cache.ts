/**
 * Paid, opt-in provider benchmark. Run from the repo root with OPENAI_API_KEY set:
 * pnpm exec tsx --tsconfig tsconfig.base.json scripts/benchmark-bot-cache.ts before|after
 * Before reads provider, policy, and legacy journal sources from the baseline commit,
 * overridable with BOT_CACHE_BASELINE_REF, into .context/bot-cache/.
 * Only synthetic local fixtures are used. Reports contain usage metadata, never prompts or keys.
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
	generateHanabiGameData,
	generatePlayer,
	HanabiGameActionType,
	HanabiStage,
	type HanabiTile,
} from '@hanabi/shared';
import {
	appendBotHistory,
	createBotHistory,
	type BotHistory,
} from '../apps/server/src/games/hanabi/bots/BotHistory.js';
import { buildBotObservation } from '../apps/server/src/games/hanabi/bots/BotObservation.js';
import type { BotConversation } from '../apps/server/src/games/hanabi/bots/BotConversation.js';

const baselineRef =
	process.env.BOT_CACHE_BASELINE_REF ?? 'eb13670c60d2ecfc3eb5c97256d7c9687f74cce3';

const mode = process.argv[2];
assert(
	mode === 'before' || mode === 'after',
	'Specify before or after; this makes four paid API requests.',
);
assert(process.env.OPENAI_API_KEY, 'OPENAI_API_KEY is required.');
const directory = resolve('.context/bot-cache');
const botsDirectory = resolve('apps/server/src/games/hanabi/bots');
await mkdir(directory, { recursive: true });

// Legacy journal code is confined to the paid baseline fixture, never the runtime.
const baselineModules = ['OpenAiBot', 'BotPolicy', 'BotNotepad'];
if (mode === 'before') {
	await writeFile(
		resolve(directory, 'conventions.before.md'),
		execFileSync(
			'git',
			['show', `${baselineRef}:apps/server/src/games/hanabi/bots/conventions.md`],
			{ encoding: 'utf8' },
		),
	);
	for (const name of baselineModules) {
		const snapshot = resolve(directory, `${name}.before.ts`);
		const source = execFileSync(
			'git',
			['show', `${baselineRef}:apps/server/src/games/hanabi/bots/${name}.ts`],
			{ encoding: 'utf8' },
		);
		await writeFile(snapshot, source);
		const rewritten = source
			.replaceAll(
				/from '\.\/(.*?)\.js'/g,
				(_match, module: string) =>
					`from '${
						pathToFileURL(
							baselineModules.includes(module)
								? resolve(directory, `${module}.baseline.ts`)
								: resolve(botsDirectory, `${module}.ts`),
						).href
					}'`,
			)
			.replace(
				"from 'openai'",
				`from '${pathToFileURL(resolve('apps/server/node_modules/openai/index.mjs')).href}'`,
			)
			.replace(
				"new URL('./conventions.md', import.meta.url)",
				`new URL('${pathToFileURL(resolve(directory, 'conventions.before.md')).href}')`,
			);
		await writeFile(resolve(directory, `${name}.baseline.ts`), rewritten);
	}
}
const providerPath =
	mode === 'before'
		? resolve(directory, 'OpenAiBot.baseline.ts')
		: resolve(botsDirectory, 'OpenAiBot.ts');
const policyPath =
	mode === 'before'
		? resolve(directory, 'BotPolicy.baseline.ts')
		: resolve(botsDirectory, 'BotPolicy.ts');
const { OpenAiBot } = (await import(
	pathToFileURL(providerPath).href
)) as typeof import('../apps/server/src/games/hanabi/bots/OpenAiBot.js');
const { createBotPolicy, createRoundBotPolicy } = (await import(
	pathToFileURL(policyPath).href
)) as typeof import('../apps/server/src/games/hanabi/bots/BotPolicy.js');

function fixtures() {
	const colors = ['red', 'yellow', 'green', 'blue', 'white'] as const;
	const tiles: Record<string, HanabiTile> = {};
	for (let index = 0; index < 30; index++) {
		const id = `card-${index.toString().padStart(2, '0')}`;
		tiles[id] = {
			id,
			color: colors[index % 5],
			number: ((Math.floor(index / 5) % 5) + 1) as HanabiTile['number'],
		};
	}
	const ids = Object.keys(tiles);
	const state = generateHanabiGameData({
		stage: HanabiStage.Playing,
		players: {
			bot: generatePlayer({ id: 'bot', name: 'Synthetic Bot' }),
			human: generatePlayer({ id: 'human', name: 'Synthetic Teammate' }),
		},
		turnOrder: ['bot', 'human'],
		currentPlayerId: 'bot',
		clues: 7,
		tiles,
		playerTiles: { bot: ids.slice(0, 5), human: ids.slice(5, 10) },
		remainingTiles: ids.slice(10),
	});
	let history: BotHistory = createBotHistory(state, 2);
	const result = [];
	for (let turn = 0; turn < 4; turn++) {
		const observation = buildBotObservation(state, 'bot', history, 2);
		const tileId = state.playerTiles.bot[0];
		const action = observation.legalActions.find(
			({ action }) => action.type === 'discard' && action.tileId === tileId,
		);
		assert(action);
		observation.legalActions = [action];
		assert.equal(history.version, 2);
		const event = history.version === 2 ? history.events.at(-1) : undefined;
		result.push({
			observation,
			checkpoint: event
				? { eventId: event.eventId, sequence: event.sequence, turnIndex: event.turnIndex }
				: { eventId: 'initial', sequence: 0, turnIndex: 0 },
			rules: structuredClone(state),
		});
		const beforeDiscard = structuredClone(state);
		state.playerTiles.bot.shift();
		state.playerTiles.bot.push(state.remainingTiles[0]);
		state.remainingTiles = state.remainingTiles.slice(1);
		state.discardedTiles = [...state.discardedTiles, tileId];
		state.clues = 8;
		state.currentPlayerId = 'human';
		history = appendBotHistory(
			history,
			{
				id: `script-discard-${turn}`,
				type: HanabiGameActionType.Discard,
				playerId: 'bot',
				tile: tiles[tileId],
			},
			state,
			beforeDiscard,
		);
		const beforeClue = structuredClone(state);
		const number = tiles[state.playerTiles.bot.at(-1)!].number;
		state.clues = 7;
		state.currentPlayerId = 'bot';
		history = appendBotHistory(
			history,
			{
				id: `script-clue-${turn}`,
				type: HanabiGameActionType.GiveNumberClue,
				playerId: 'human',
				recipientId: 'bot',
				number,
				tiles: state.playerTiles.bot
					.map((id) => tiles[id])
					.filter((tile) => tile.number === number),
			},
			state,
			beforeClue,
		);
	}
	return result;
}

interface ApiResponse {
	model?: string;
	id?: string;
	status?: string;
	error?: { code?: string };
	usage?: {
		input_tokens?: number;
		output_tokens?: number;
		input_tokens_details?: { cached_tokens?: number; cache_write_tokens?: number };
	};
}
interface ApiRequest {
	model: string;
	input: string | { role: string; content: string }[];
	previous_response_id?: string;
	store: boolean;
	instructions?: string;
	text?: { format: unknown };
}
interface Measurement {
	turn: number;
	httpStatus: number;
	model: string;
	responseId: string | null;
	previousResponseId: string | null;
	status: string | null;
	errorCode: string | null;
	inputTokens: number | null;
	outputTokens: number | null;
	cachedTokens: number | null;
	cacheWriteTokens: number | null;
	inputTokenDetails: NonNullable<ApiResponse['usage']>['input_tokens_details'] | null;
	latencyMs: number;
	requestBytes: number;
	store: boolean;
	developerMessageCount: number;
	instructionsBytes: number;
	schemaHash: string;
}
const records: Measurement[] = [];
const nativeFetch = globalThis.fetch;
const measuredFetch: typeof fetch = async (url, options) => {
	assert.equal(typeof options?.body, 'string');
	const body = options!.body as string;
	const request = JSON.parse(body) as ApiRequest;
	if (mode === 'after') {
		assert(!/privateNotepad|"notes"|scratchpad/i.test(body), 'Request contains scratchpad data.');
	}
	const started = performance.now();
	const response = await nativeFetch(url, options);
	const data = (await response.clone().json()) as ApiResponse;
	const input =
		typeof request.input === 'string' ? [{ role: 'user', content: request.input }] : request.input;
	const record = {
		turn: records.length + 1,
		httpStatus: response.status,
		model: data.model ?? request.model,
		responseId: data.id ?? null,
		previousResponseId: request.previous_response_id ?? null,
		status: data.status ?? null,
		errorCode: data.error?.code ?? null,
		inputTokens: data.usage?.input_tokens ?? null,
		outputTokens: data.usage?.output_tokens ?? null,
		cachedTokens: data.usage?.input_tokens_details?.cached_tokens ?? null,
		cacheWriteTokens: data.usage?.input_tokens_details?.cache_write_tokens ?? null,
		inputTokenDetails: data.usage?.input_tokens_details ?? null,
		latencyMs: Math.round(performance.now() - started),
		requestBytes: Buffer.byteLength(body),
		store: request.store,
		developerMessageCount: input.filter((item: { role: string }) => item.role === 'developer')
			.length,
		instructionsBytes: Buffer.byteLength(request.instructions ?? ''),
		schemaHash: createHash('sha256').update(JSON.stringify(request.text?.format)).digest('hex'),
	};
	records.push(record);
	console.log(JSON.stringify(record));
	await save();
	return response;
};
const fixture = fixtures();
const fixtureHash = createHash('sha256')
	.update(JSON.stringify(fixture.map(({ observation }) => observation)))
	.digest('hex');
const sourceSha256 = Object.fromEntries(
	await Promise.all(
		(mode === 'before' ? baselineModules : ['OpenAiBot', 'BotPolicy', 'BotConversation']).map(
			async (name) => [
				name,
				createHash('sha256')
					.update(
						await readFile(
							mode === 'before'
								? resolve(directory, `${name}.before.ts`)
								: resolve(botsDirectory, `${name}.ts`),
						),
					)
					.digest('hex'),
			],
		),
	),
);
sourceSha256.conventions = createHash('sha256')
	.update(
		await readFile(
			mode === 'before'
				? resolve(directory, 'conventions.before.md')
				: resolve(botsDirectory, 'conventions.md'),
		),
	)
	.digest('hex');
const policy = createRoundBotPolicy(
	createBotPolicy('gpt-5.6-sol', undefined, 'medium'),
	fixture[0].rules,
);
const provider = new OpenAiBot({
	apiKey: process.env.OPENAI_API_KEY,
	fetch: measuredFetch,
	timeoutMs: 120_000,
	maxOutputTokens: 4_096,
});
// These types and entries reproduce only the historical baseline request contract.
interface BaselineJournalEntry {
	decisionId: string;
	opportunity: 'turn';
	observedAt: { eventId: string; sequence: number; turnIndex: number };
	recordedAt: { eventId: string; sequence: number; turnIndex: number };
	sourceClueEventIds: string[];
	explanation: string;
	notes: string | null;
}
const baselineJournal =
	mode === 'before' ? { version: 1 as const, entries: [] as BaselineJournalEntry[] } : undefined;
let conversation: BotConversation | undefined;
async function save() {
	await writeFile(
		resolve(directory, `${mode}.json`),
		JSON.stringify(
			{
				mode,
				scratchpadEnabled: mode === 'before',
				measuredAt: new Date().toISOString(),
				fixtureHash,
				method:
					'Four synthetic evolving five-card Hanabi discard turns, interleaved with teammate clues. Supplied action list narrowed to one legal scripted discard for identical before/after state. No live game mutations. Medium reasoning, 4096 output-token limit. Raw API usage captured from response; null means the field was absent.',
				policyHash: policy.hash,
				sourceSha256,
				records,
			},
			null,
			2,
		) + '\n',
	);
}
for (const [index, item] of fixture.entries()) {
	try {
		const decision = await provider.chooseAction({
			roundId: 'synthetic-cache-benchmark-round',
			conversation,
			observation: item.observation,
			legalActions: item.observation.legalActions,
			policy,
			...(baselineJournal ? { notepad: structuredClone(baselineJournal) } : {}),
			signal: new AbortController().signal,
		});
		conversation = decision.conversation;
		baselineJournal?.entries.push({
			decisionId: `benchmark-${index}`,
			opportunity: 'turn',
			observedAt: item.checkpoint,
			recordedAt: {
				eventId: `event-${index * 2 + 1}`,
				sequence: index * 2 + 1,
				turnIndex: index * 2 + 1,
			},
			sourceClueEventIds: [],
			explanation: decision.explanation ?? '',
			notes: (decision as typeof decision & { notes?: string | null }).notes ?? null,
		});
	} catch (error) {
		await save();
		console.error(
			`Benchmark stopped: ${error instanceof Error ? error.message : 'provider error'}`,
		);
		process.exitCode = 1;
		break;
	}
}
if (records.length === 4 && mode === 'after' && !process.exitCode) {
	assert(
		records
			.slice(1)
			.some((record) => typeof record.cachedTokens === 'number' && record.cachedTokens > 0),
		'No API-reported cache hits on subsequent turns.',
	);
	for (let index = 1; index < records.length; index++)
		assert.equal(
			records[index].previousResponseId,
			records[index - 1].responseId,
			'Response chaining must use the preceding accepted response.',
		);
	assert(
		records
			.slice(1)
			.every((record) => record.instructionsBytes === 0 && record.developerMessageCount === 0),
		'Continuation resent preamble.',
	);
	assert(
		records.every((record) => record.schemaHash === records[0].schemaHash),
		'Structured-output schema must remain stable.',
	);
	const baseline = JSON.parse(await readFile(resolve(directory, 'before.json'), 'utf8')) as {
		fixtureHash: string;
	};
	assert.equal(fixtureHash, baseline.fixtureHash, 'Before/after observations must be identical.');
}
