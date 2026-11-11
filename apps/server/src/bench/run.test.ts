import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { parseConfig } from './config.js';
import { BenchGame, type BenchObservation, type BenchTranscript } from './engine.js';
import type { ModelConfig, ModelProvider, ModelRequest, ModelResponse } from './provider.js';
import { runGame, type PrivateEntry } from './run.js';
import { readJson } from './storage.js';

const directories: string[] = [];
async function runDirectory(): Promise<string> {
	const parent = await mkdtemp(join(tmpdir(), 'hanabi-run-test-'));
	directories.push(parent);
	return join(parent, 'game');
}
afterEach(async () => {
	await Promise.all(
		directories.splice(0).map((path) => rm(path, { recursive: true, force: true })),
	);
});

interface PlayerInput {
	opportunity: PrivateEntry['opportunity'];
	observation: BenchObservation;
	extra?: {
		transcript?: BenchTranscript;
		debriefs?: Array<{ playerId: string; reflection: string }>;
		discussion?: Array<{ playerId: string; reflection: string }>;
	};
}
function input(request: ModelRequest): PlayerInput {
	return JSON.parse(request.messages.at(-1)!.content) as PlayerInput;
}

class RecordingPlayer implements ModelProvider {
	readonly requests: ModelRequest[] = [];
	readonly inputs: PlayerInput[] = [];
	complete(_config: ModelConfig, request: ModelRequest): Promise<ModelResponse> {
		this.requests.push(structuredClone(request));
		const prompt = input(request);
		this.inputs.push(prompt);
		const marker = `PRIVATE:${prompt.observation.playerId}:`;
		return Promise.resolve({
			value:
				prompt.opportunity === 'turn'
					? {
							actionId: prompt.observation.legalActions.find(
								({ action }) => action.type === 'play',
							)!.id,
							explanation: `${marker}${'Unrestricted explanation. '.repeat(200)}`,
						}
					: { reflection: `${marker}${prompt.opportunity}:${prompt.observation.turn}` },
			usage: { inputTokens: 11, outputTokens: 5, cachedInputTokens: 3 },
			durationMs: 1,
		});
	}
}

describe('single-game harness', () => {
	it('plays a real game, isolates conversations, reflects after every action including terminal, and saves replayable evidence', async () => {
		const directory = await runDirectory();
		const config = await parseConfig({ conventions: 'TEST CONVENTION' });
		const provider = new RecordingPlayer();
		const seed = 'private-seed-never-sent-to-players';
		const result = await runGame({ config, directory, seed, provider });
		expect(result.status).toBe('completed');
		expect(result.turns).toBeGreaterThanOrEqual(3);
		expect(result.calls).toBe(result.turns * 2);
		expect(result.usageReportedCalls).toBe(result.calls);
		expect(result.usage).toEqual({
			inputTokens: result.calls * 11,
			outputTokens: result.calls * 5,
			cachedInputTokens: result.calls * 3,
		});
		for (let index = 0; index < provider.requests.length; index++) {
			const request = provider.requests[index];
			const prompt = provider.inputs[index];
			const ownId = prompt.observation.playerId;
			expect(prompt.opportunity).toBe(index % 2 === 0 ? 'turn' : 'result');
			expect(
				prompt.observation.hands
					.find(({ playerId }) => playerId === ownId)!
					.cards.every(({ face }) => face === null),
			).toBe(true);
			expect(
				prompt.observation.hands
					.filter(({ playerId }) => playerId !== ownId)
					.flatMap(({ cards }) => cards)
					.every(({ face }) => face !== null),
			).toBe(true);
			expect(request.instructions).toContain('TEST CONVENTION');
			expect(JSON.stringify(request)).not.toContain(seed);
			expect(JSON.stringify(prompt)).not.toMatch(/possibleIdentities|remainingTiles|initialState/);
			for (const otherId of ['player-1', 'player-2', 'player-3'].filter((id) => id !== ownId)) {
				expect(JSON.stringify(request.messages)).not.toContain(`PRIVATE:${otherId}:`);
			}
			if (prompt.opportunity === 'result') {
				const previous = provider.inputs[index - 1];
				expect(ownId).toBe(previous.observation.playerId);
				expect(prompt.observation.turn).toBe(previous.observation.turn + 1);
				expect(prompt.observation.events).toHaveLength(1);
				const event = prompt.observation.events[0];
				expect(event.tile?.color).toBeDefined();
				expect(event.valid).toBeTypeOf('boolean');
				if (event.drawnCard) expect(event.drawnCard.face).toBeNull();
			}
		}
		expect(provider.inputs.at(-1)!.observation.stage).toBe('Finished');
		const transcript = (await readJson(join(directory, 'transcript.json'))) as BenchTranscript;
		const replay = new BenchGame(transcript.options);
		for (const event of transcript.events) {
			const action = replay
				.legalActions(event.playerId)
				.find(({ action }) => JSON.stringify(action) === JSON.stringify(event.action))!;
			replay.apply(event.playerId, action.id);
		}
		expect(replay.transcript()).toEqual(transcript);
		expect(await readJson(join(directory, 'result.json'))).toEqual(result);
		expect(await readFile(join(directory, 'conventions.md'), 'utf8')).toBe(config.conventions);
		const log = (await readJson(join(directory, 'private', 'player-1.json'))) as PrivateEntry[];
		expect((log[0].response as { explanation: string }).explanation).toHaveLength(
			`PRIVATE:player-1:${'Unrestricted explanation. '.repeat(200)}`.length,
		);
		expect(
			(await stat(join(directory, 'private', 'calls', '0001', 'request.json'))).mode & 0o777,
		).toBe(0o600);
	});

	it('collects independent end-game debriefs before revealing shared hidden evidence for optional discussion', async () => {
		const directory = await runDirectory();
		const provider = new RecordingPlayer();
		const result = await runGame({
			config: await parseConfig({ discussion: true }),
			directory,
			seed: 'discussion',
			provider,
		});
		expect(result.status).toBe('completed');
		const debriefs = provider.inputs.filter(({ opportunity }) => opportunity === 'debrief');
		const discussion = provider.inputs.filter(({ opportunity }) => opportunity === 'discussion');
		expect(debriefs).toHaveLength(3);
		expect(discussion).toHaveLength(3);
		expect(provider.inputs.slice(-6).map(({ opportunity }) => opportunity)).toEqual([
			'debrief',
			'debrief',
			'debrief',
			'discussion',
			'discussion',
			'discussion',
		]);
		for (const prompt of debriefs) {
			expect(typeof prompt.extra).toBe('string');
			expect(
				prompt.observation.hands
					.find(({ playerId }) => playerId === prompt.observation.playerId)!
					.cards.every(({ face }) => face === null),
			).toBe(true);
		}
		for (const [index, prompt] of discussion.entries()) {
			expect(prompt.extra!.transcript!.initialState.remainingTiles.length).toBeGreaterThan(0);
			expect(prompt.extra!.debriefs).toHaveLength(3);
			expect(prompt.extra!.discussion).toHaveLength(index);
		}
		const savedDiscussion = (await readJson(join(directory, 'discussion.json'))) as {
			debriefs: unknown[];
			discussion: unknown[];
		};
		expect(savedDiscussion.debriefs).toHaveLength(3);
		expect(savedDiscussion.discussion).toHaveLength(3);
	});

	it.each([
		[{ actionId: 'not-legal', explanation: 'An invalid action.' }, 'Illegal action'],
		[
			{ actionId: 'action-0', explanation: ' ', unexpected: true },
			'Unexpected turn response fields',
		],
		[{ actionId: 'action-0', explanation: '' }, 'nonempty explanation'],
	])(
		'records an invalid model response without applying a move or hiding the failure: %j',
		async (value, error) => {
			const directory = await runDirectory();
			const result = await runGame({
				config: await parseConfig({}),
				directory,
				seed: 'invalid',
				provider: { complete: () => Promise.resolve({ value, durationMs: 0 }) },
			});
			expect(result).toMatchObject({ status: 'failed', turns: 0, calls: 1, perfect: false });
			expect(result.error).toContain(error);
			expect(
				await readJson(join(directory, 'private', 'calls', '0001', 'response.json')),
			).toMatchObject({ value });
			expect(
				((await readJson(join(directory, 'transcript.json'))) as BenchTranscript).events,
			).toEqual([]);
		},
	);

	it('preserves provider failures without silently substituting the scripted player', async () => {
		const directory = await runDirectory();
		const result = await runGame({
			config: await parseConfig({}),
			directory,
			seed: 'failure',
			provider: { complete: () => Promise.reject(new Error('provider unavailable')) },
		});
		expect(result).toMatchObject({
			status: 'failed',
			error: 'provider unavailable',
			turns: 0,
			calls: 1,
		});
		expect(await readJson(join(directory, 'private', 'calls', '0001', 'error.json'))).toEqual({
			error: 'provider unavailable',
		});
		await expect(
			runGame({ config: await parseConfig({}), directory, seed: 'replacement' }),
		).rejects.toThrow('EEXIST');
		expect(await readJson(join(directory, 'result.json'))).toEqual(result);
	});
});
