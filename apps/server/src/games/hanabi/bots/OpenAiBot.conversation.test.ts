import { generateHanabiGameData, generatePlayer, HanabiStage } from '@hanabi/shared';
import { describe, expect, it, vi } from 'vitest';
import { createBotHistory } from './BotHistory.js';
import { buildBotObservation, type BotObservation } from './BotObservation.js';
import { createBotPolicy, createRoundBotPolicy } from './BotPolicy.js';
import { OpenAiBot, type BotDecisionRequest } from './OpenAiBot.js';

function request(): BotDecisionRequest {
	const game = generateHanabiGameData({
		stage: HanabiStage.Playing,
		players: { bot: generatePlayer({ id: 'bot' }), human: generatePlayer({ id: 'human' }) },
		turnOrder: ['bot', 'human'],
		currentPlayerId: 'bot',
		tiles: { a: { id: 'a', color: 'red', number: 1 }, b: { id: 'b', color: 'blue', number: 2 } },
		playerTiles: { bot: ['a'], human: ['b'] },
	});
	const observation = buildBotObservation(game, 'bot', createBotHistory(game, 2), 2);
	return {
		roundId: 'round-1',
		observation,
		legalActions: observation.legalActions,
		policy: createRoundBotPolicy(createBotPolicy(), game),
		signal: new AbortController().signal,
	};
}
function response(actionId: string | null, id = 'resp_1', extra = {}) {
	return Response.json({
		id,
		object: 'response',
		status: 'completed',
		output: [
			{
				type: 'message',
				role: 'assistant',
				content: [
					{
						type: 'output_text',
						text: JSON.stringify({
							actionId,
							arrangement: null,
							explanation: 'A concise decision.',
						}),
						annotations: [],
					},
				],
			},
		],
		usage: { input_tokens: 4000, output_tokens: 50, input_tokens_details: { cached_tokens: 3072 } },
		...extra,
	});
}
function body(mock: ReturnType<typeof vi.fn<typeof fetch>>, index: number) {
	return JSON.parse(mock.mock.calls[index][1]?.body as string) as {
		input: Array<{ role: string; content: string }>;
		store: boolean;
		instructions?: string;
		previous_response_id?: string;
		prompt_cache_key: string;
		text: unknown;
	};
}
function userInput(sent: ReturnType<typeof body>) {
	return JSON.parse(sent.input.find((item) => item.role === 'user')!.content) as Record<
		string,
		unknown
	> &
		Pick<BotObservation, 'players'> & { history: { initialHands?: unknown[]; events?: unknown[] } };
}

describe('OpenAiBot saved conversations', () => {
	it('bootstraps once, retains a response chain across provider instances, and reports API cache usage', async () => {
		const input = request();
		const fetchMock = vi
			.fn<typeof fetch>()
			.mockImplementation(() => Promise.resolve(response(input.legalActions[0].id)));
		const first = await new OpenAiBot({ apiKey: 'test', fetch: fetchMock }).chooseAction(input);
		expect(first.cachedInputTokens).toBe(3072);
		expect(first.conversation).toMatchObject({
			responseId: 'resp_1',
			roundId: 'round-1',
			playerId: 'bot',
			historyLength: 0,
		});
		await new OpenAiBot({ apiKey: 'test', fetch: fetchMock }).chooseAction({
			...input,
			conversation: first.conversation,
		});
		const initial = body(fetchMock, 0),
			next = body(fetchMock, 1);
		expect(initial.store).toBe(true);
		expect(initial.input[0].role).toBe('developer');
		expect(initial.instructions).toBeUndefined();
		expect(initial.previous_response_id).toBeUndefined();
		expect(userInput(initial).history.initialHands).toHaveLength(2);
		expect(next.previous_response_id).toBe('resp_1');
		expect(next.input).toHaveLength(1);
		expect(next.prompt_cache_key).toBe(initial.prompt_cache_key);
		expect(userInput(next).history).toEqual({ events: [] });
		for (const field of ['rules', 'board', 'privateNotepad'])
			expect(userInput(next)[field]).toBeUndefined();
		expect(userInput(next).players[0].hand[0].face).toBeNull();
		expect(userInput(next).players[1].hand[0].face).toEqual({ color: 'blue', number: 2 });
	});

	it('sends only new history events and keeps request schemas identical across hand changes and opportunities', async () => {
		const input = request();
		const fetchMock = vi
			.fn<typeof fetch>()
			.mockImplementation(() => Promise.resolve(response(input.legalActions[0].id)));
		const provider = new OpenAiBot({ apiKey: 'test', fetch: fetchMock });
		const first = await provider.chooseAction(input);
		if (input.observation.version !== 2) throw new Error('Expected enriched observation');
		const event = {
			eventId: 'arrangement-1',
			sequence: 1,
			turnIndex: 0,
			type: 'arrangement' as const,
			actorId: 'human',
			before: { cards: [], layout: { orderedRow: [], lowerArea: [] } },
			after: { cards: [], layout: { orderedRow: [], lowerArea: [] } },
			changedTileIds: [],
		};
		input.observation.history.events.push(event);
		input.observation.players[0].hand[0].tileId = 'replacement';
		fetchMock.mockImplementation(() => Promise.resolve(response(null, 'resp_2')));
		const second = await provider.chooseAction({
			...input,
			conversation: first.conversation,
			opportunity: 'clue',
			legalActions: [],
		});
		expect(userInput(body(fetchMock, 1)).history).toEqual({ events: [event] });
		expect(second.conversation).toMatchObject({ historyLength: 1, lastEventId: 'arrangement-1' });
		expect(body(fetchMock, 1).text).toEqual(body(fetchMock, 0).text);
		await provider.chooseAction({
			...input,
			conversation: second.conversation,
			opportunity: 'result',
			sourceActionEventId: 'action-2',
			legalActions: [],
		});
		expect(body(fetchMock, 2).previous_response_id).toBe('resp_2');
		expect(body(fetchMock, 2).text).toEqual(body(fetchMock, 0).text);
	});

	it.each(['round', 'seat', 'policy', 'history'] as const)(
		'bootstraps instead of reusing a mismatched %s checkpoint',
		async (mismatch) => {
			const input = request();
			const fetchMock = vi
				.fn<typeof fetch>()
				.mockImplementation(() => Promise.resolve(response(input.legalActions[0].id)));
			const provider = new OpenAiBot({ apiKey: 'test', fetch: fetchMock });
			const first = await provider.chooseAction(input);
			const conversation = { ...first.conversation! };
			if (mismatch === 'round') conversation.roundId = 'another-round';
			if (mismatch === 'seat') conversation.playerId = 'another-seat';
			if (mismatch === 'policy') conversation.policyHash = 'another-policy';
			if (mismatch === 'history') conversation.historyLength = 1;
			await provider.chooseAction({ ...input, conversation });
			expect(body(fetchMock, 1).previous_response_id).toBeUndefined();
			expect(body(fetchMock, 1).input[0].role).toBe('developer');
		},
	);

	it.each(['previous_response_not_found', 'context_length_exceeded'])(
		'recovers %s with full context without mutating the accepted checkpoint',
		async (code) => {
			const input = request();
			const fetchMock = vi
				.fn<typeof fetch>()
				.mockImplementation(() => Promise.resolve(response(input.legalActions[0].id)));
			const provider = new OpenAiBot({ apiKey: 'test', fetch: fetchMock });
			const first = await provider.chooseAction(input);
			fetchMock
				.mockResolvedValueOnce(
					Response.json({ error: { code, message: 'Recovery needed' } }, { status: 400 }),
				)
				.mockResolvedValueOnce(response(input.legalActions[0].id, 'resp_recovered'));
			const recovered = await provider.chooseAction({ ...input, conversation: first.conversation });
			expect(recovered.conversation?.responseId).toBe('resp_recovered');
			expect(first.conversation?.responseId).toBe('resp_1');
			expect(body(fetchMock, 1).previous_response_id).toBe('resp_1');
			expect(body(fetchMock, 2).previous_response_id).toBeUndefined();
			expect(userInput(body(fetchMock, 2)).history.initialHands).toHaveLength(2);
		},
	);

	it('rejects out-of-menu actions despite the stable schema and never mutates the accepted cursor', async () => {
		const input = request();
		const fetchMock = vi
			.fn<typeof fetch>()
			.mockImplementation(() => Promise.resolve(response(input.legalActions[0].id)));
		const provider = new OpenAiBot({ apiKey: 'test', fetch: fetchMock });
		const first = await provider.chooseAction(input);
		fetchMock.mockResolvedValue(response('not-in-menu', 'resp_invalid'));
		await expect(
			provider.chooseAction({ ...input, conversation: first.conversation }),
		).rejects.toMatchObject({ code: 'invalid_action' });
		expect(first.conversation?.responseId).toBe('resp_1');
	});
});
