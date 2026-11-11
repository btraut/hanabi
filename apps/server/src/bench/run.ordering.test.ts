import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { parseConfig } from './config.js';
import type { BenchObservation, BenchTranscript } from './engine.js';
import type { ModelRequest } from './provider.js';
import { runGame, ScriptedProvider } from './run.js';
import { readJson } from './storage.js';

const directories: string[] = [];
async function outputDirectory(): Promise<string> {
	const directory = await mkdtemp(join(tmpdir(), 'hanabi-ordering-run-'));
	directories.push(directory);
	return join(directory, 'game');
}
afterEach(async () => {
	await Promise.all(
		directories.splice(0).map((path) => rm(path, { recursive: true, force: true })),
	);
});

function input(request: ModelRequest): { opportunity: string; observation: BenchObservation } {
	return JSON.parse(request.messages.at(-1)!.content) as ReturnType<typeof input>;
}

describe('fixed hand order in the single-game harness', () => {
	it('keeps surviving cards in acquisition order, appends draws, and exposes no movement interface', async () => {
		const requests: ModelRequest[] = [];
		const scripted = new ScriptedProvider();
		const result = await runGame({
			config: await parseConfig({}),
			directory: await outputDirectory(),
			seed: 'fixed-order',
			provider: {
				complete(config, request) {
					requests.push(structuredClone(request));
					return scripted.complete(config, request);
				},
			},
		});
		expect(result.status, result.error).toBe('completed');
		expect(result.calls).toBe(result.turns * 2);
		let draws = 0;
		let clues = 0;
		for (let index = 0; index < requests.length; index += 2) {
			const before = input(requests[index]);
			const after = input(requests[index + 1]);
			expect(before.opportunity).toBe('turn');
			expect(after.opportunity).toBe('result');
			expect(after.observation.playerId).toBe(before.observation.playerId);
			const event = after.observation.events.at(-1)!;
			const own = before.observation.playerId;
			const oldCards = before.observation.hands
				.find((hand) => hand.playerId === own)!
				.cards.map((card) => card.id);
			const newCards = after.observation.hands
				.find((hand) => hand.playerId === own)!
				.cards.map((card) => card.id);
			if (event.action.type === 'clue') {
				clues++;
				expect(newCards).toEqual(oldCards);
			} else {
				const survivors = oldCards.filter((id) => id !== event.tile!.id);
				expect(newCards).toEqual(event.drawnCard ? [...survivors, event.drawnCard.id] : survivors);
				if (event.drawnCard) draws++;
			}
		}
		expect(draws).toBeGreaterThan(0);
		expect(clues).toBeGreaterThan(0);
		for (const request of requests) {
			const { observation } = input(request);
			expect(observation.version).toBe(1);
			expect(JSON.stringify(observation)).not.toMatch(
				/"(?:layout|orderedRow|lowerArea|tilePositions|position|x|y|revision|allowDragging)":/,
			);
			expect(request.schema.properties).not.toHaveProperty('arrangement');
			expect(request.schema.additionalProperties).toBe(false);
			expect(
				observation.hands
					.find((hand) => hand.playerId === observation.playerId)!
					.cards.every((card) => card.face === null),
			).toBe(true);
		}
	});

	it('rejects an arrangement response before applying its otherwise legal action', async () => {
		const directory = await outputDirectory();
		const result = await runGame({
			config: await parseConfig({}),
			directory,
			seed: 'unexpected-arrangement',
			provider: {
				complete(_config, request) {
					const { observation } = input(request);
					return Promise.resolve({
						value: {
							actionId: observation.legalActions[0].id,
							explanation: 'Attempt an unsupported arrangement.',
							arrangement: null,
						},
						durationMs: 0,
					});
				},
			},
		});
		expect(result).toMatchObject({ status: 'failed', turns: 0, calls: 1 });
		const transcript = (await readJson(join(directory, 'transcript.json'))) as BenchTranscript;
		expect(transcript.events).toEqual([]);
		expect(transcript.finalState).toEqual(transcript.initialState);
	});
});
