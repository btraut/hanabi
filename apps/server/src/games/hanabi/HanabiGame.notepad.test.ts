import { getScope, HanabiGameActionType, PubSub, type HanabiMessage } from '@hanabi/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import type ServerSocketManager from '../../utils/SocketManager.js';
import type { SaveGameDelegate } from '../server/GameStore.js';
import { createGameTranscript } from './GameTranscript.js';
import type HanabiGame from './HanabiGame.js';
import type { HanabiGameSerialized } from './HanabiGame.js';
import HanabiGameFactory from './HanabiGameFactory.js';
import { createBotHistory } from './bots/BotHistory.js';
import { createBotPolicy, createRoundBotPolicy } from './bots/BotPolicy.js';
import { BotRuntime } from './bots/BotRuntime.js';
import type { BotDecision, BotDecisionProvider, BotDecisionRequest } from './bots/OpenAiBot.js';

class FakeSocketManager {
	readonly onMessage = new PubSub<{ userId: string | undefined; message: HanabiMessage }>();
	readonly onAuthenticate = new PubSub<{ userId: string }>();
	readonly onDisconnect = new PubSub<{ userId: string }>();
	readonly sent: Array<{ recipients: string | readonly string[]; message: HanabiMessage }> = [];

	send(recipients: string | readonly string[], message: HanabiMessage) {
		this.sent.push({ recipients, message });
	}
}

const games: HanabiGame[] = [];
const startupPolicy = createBotPolicy(
	'test-model',
	'Track tentative conventions in private notes.',
);

function captureConsole() {
	return vi.spyOn(console, 'log').mockImplementation(() => undefined);
}
let consoleLog: ReturnType<typeof captureConsole>;

beforeEach(() => {
	consoleLog = captureConsole();
});
afterEach(async () => {
	for (const game of games.splice(0)) {
		game.cleanUp();
		game.stopSaving();
		await game.flushSaves();
	}
	vi.restoreAllMocks();
});

function snapshot(game: HanabiGame): HanabiGameSerialized {
	return JSON.parse(game.serialize()!) as HanabiGameSerialized;
}

function reply(request: BotDecisionRequest, notes: string | null = null): BotDecision {
	const action =
		request.legalActions.find(({ action }) => action.type === 'clue' && action.to === 'host') ??
		request.legalActions.find(({ action }) => action.type === 'clue');
	return {
		actionId: request.opportunity === 'clue' ? null : action!.id,
		arrangement: null,
		explanation: `Decision summary for ${request.observation.playerId}.`,
		notes,
		inputTokens: 10,
		outputTokens: 5,
	};
}

function createHarness(serialized?: HanabiGameSerialized) {
	const sockets = new FakeSocketManager();
	const saved: HanabiGameSerialized[] = [];
	const saveDelegate: SaveGameDelegate = {
		saveGame: vi.fn((game) => {
			saved.push(snapshot(game as HanabiGame));
			return Promise.resolve();
		}),
		deleteGame: vi.fn().mockResolvedValue(undefined),
	};
	const chooseAction = vi
		.fn<BotDecisionProvider['chooseAction']>()
		.mockImplementation((request) => Promise.resolve(reply(request)));
	const factory = new HanabiGameFactory(
		2,
		false,
		undefined,
		new BotRuntime({ chooseAction }, startupPolicy),
	);
	const game = serialized
		? factory.hydrate(
				JSON.stringify(serialized),
				sockets as unknown as ServerSocketManager,
				saveDelegate,
			)
		: factory.create('host', sockets as unknown as ServerSocketManager, saveDelegate);
	games.push(game);
	return { game, sockets, saved, chooseAction };
}

type Harness = ReturnType<typeof createHarness>;
type Payloads = { [Message in HanabiMessage as Message['type']]: Message['data'] };

function send<Type extends HanabiMessage['type']>(
	harness: Harness,
	userId: string,
	type: Type,
	data: Payloads[Type],
) {
	harness.sockets.onMessage.emit({
		userId,
		message: { scope: getScope(harness.game.title, harness.game.id), type, data } as HanabiMessage,
	});
}

function response<Type extends HanabiMessage['type']>(
	harness: Harness,
	type: Type,
	userId = 'host',
): Payloads[Type] {
	const result = [...harness.sockets.sent]
		.reverse()
		.find((sent) => sent.recipients === userId && sent.message.type === type);
	if (!result) throw new Error(`Missing ${type} for ${userId}.`);
	return result.message.data as Payloads[Type];
}

function seeded(options: { botStarts?: boolean; secondBot?: boolean } = {}) {
	const initial = createHarness();
	send(initial, 'host', 'AddPlayerMessage', { name: 'Host' });
	send(initial, 'guest', 'AddPlayerMessage', { name: 'Guest' });
	send(initial, 'host', 'AddBotMessage', undefined);
	const botId = response(initial, 'AddBotResponseMessage').playerId!;
	let secondBotId: string | undefined;
	if (options.secondBot) {
		send(initial, 'host', 'AddBotMessage', undefined);
		secondBotId = response(initial, 'AddBotResponseMessage').playerId!;
	}
	send(initial, 'host', 'StartGameMessage', undefined);
	const saved = snapshot(initial.game);
	const data = saved.data;
	data.turnOrder = ['host', 'guest', botId, ...(secondBotId ? [secondBotId] : [])];
	data.currentPlayerId = options.botStarts ? botId : 'host';
	data.allowDragging = true;
	data.criticalGameOver = false;
	data.clues = 6;
	data.actions = data.actions.map((action) =>
		action.type === HanabiGameActionType.GameStarted
			? { ...action, startingPlayerId: data.currentPlayerId! }
			: action,
	);
	saved.botRound = {
		version: 2,
		roundId: data.seed,
		policy: createRoundBotPolicy(startupPolicy, data),
		history: createBotHistory(data, 2),
		revision: 0,
		attempts: 0,
		tokens: 0,
		status: 'ready',
		lastAttemptAt: 0,
		pendingClues: [],
		notepads: {},
	};
	saved.transcript = createGameTranscript(
		{ gameId: saved.id, gameCode: saved.code },
		data,
		saved.updated,
	);
	initial.game.cleanUp();
	return { ...createHarness(saved), botId, secondBotId };
}

function giveClue(harness: Harness, botId: string) {
	const { data } = snapshot(harness.game);
	send(harness, 'host', 'GiveClueMessage', {
		to: botId,
		number: data.tiles[data.playerTiles[botId][0]].number,
	});
	expect(response(harness, 'GiveClueResponseMessage').error).toBeUndefined();
}

function entries(harness: Harness, botId: string) {
	return snapshot(harness.game).botRound?.notepads?.[botId]?.entries ?? [];
}

function events(harness: Harness) {
	const history = snapshot(harness.game).botRound!.history;
	if (history.version !== 2) throw new Error('Expected v2 history.');
	return history.events;
}

function chats(harness: Harness) {
	return snapshot(harness.game).data.actions.filter(
		(action) => action.type === HanabiGameActionType.Chat,
	);
}

function deferred() {
	let resolve!: (value: BotDecision) => void;
	const promise = new Promise<BotDecision>((complete) => {
		resolve = complete;
	});
	return { resolve, promise };
}

async function settle() {
	await new Promise((resolve) => setTimeout(resolve, 10));
}

describe('private bot notepads', () => {
	it('enables new rounds and supplies an empty private notepad before the first decision', async () => {
		const harness = createHarness();
		send(harness, 'host', 'AddPlayerMessage', { name: 'Host' });
		send(harness, 'host', 'AddBotMessage', undefined);
		const botId = response(harness, 'AddBotResponseMessage').playerId!;
		send(harness, 'host', 'StartGameMessage', undefined);
		expect(snapshot(harness.game).botRound?.policy.notepadVersion).toBe(1);
		expect(snapshot(harness.game).botRound?.notepads).toEqual({});
		if (snapshot(harness.game).data.currentPlayerId === 'host') giveClue(harness, botId);
		const pending = deferred();
		harness.chooseAction.mockReturnValue(pending.promise);
		harness.game.startBackgroundWork();
		await vi.waitFor(() => expect(harness.chooseAction).toHaveBeenCalledOnce());
		expect(harness.chooseAction.mock.calls[0][0].notepad).toEqual({ version: 1, entries: [] });
		expect(entries(harness, botId)).toEqual([]);
	});

	it('appends explanation and notes after an arranged turn with distinct observed and recorded event boundaries', async () => {
		const harness = seeded({ botStarts: true });
		const notes = 'Tentative: keep the oldest unmarked card available for discard.';
		harness.chooseAction.mockImplementation((request) => {
			const own = request.observation.players.find(({ id }) => id === harness.botId)!;
			return Promise.resolve({
				...reply(request, notes),
				arrangement: { orderedRow: own.hand.map(({ tileId }) => tileId).reverse(), lowerArea: [] },
				actionId: request.legalActions.find(({ action }) => action.type === 'discard')!.id,
			});
		});
		harness.game.startBackgroundWork();
		await vi.waitFor(() => expect(entries(harness, harness.botId)).toHaveLength(1));
		await harness.game.flushSaves();
		const [entry] = entries(harness, harness.botId);
		expect(events(harness).map(({ type }) => type)).toEqual(['arrangement', 'discard']);
		expect(entry).toMatchObject({
			opportunity: 'turn',
			notes,
			explanation: `Decision summary for ${harness.botId}.`,
			observedAt: { eventId: 'initial', sequence: 0, turnIndex: 0 },
			recordedAt: { eventId: events(harness)[1].eventId, sequence: 2, turnIndex: 1 },
			sourceClueEventIds: [],
		});
		expect(harness.saved.at(-1)?.botRound?.notepads?.[harness.botId]?.entries).toEqual([entry]);
		expect(snapshot(harness.game).data.currentPlayerId).toBe('host');
		expect(snapshot(harness.game).data.actions.slice(-2)).toMatchObject([
			{ type: HanabiGameActionType.Discard, playerId: harness.botId },
			{
				type: HanabiGameActionType.Chat,
				id: entry.decisionId,
				playerId: harness.botId,
				message: `Debug: ${entry.explanation}`,
			},
		]);
	});

	it('records an automatic explanation for a no-op clue response with nullable notes and no extra gameplay event', async () => {
		const harness = seeded();
		giveClue(harness, harness.botId);
		const before = snapshot(harness.game).data;
		const clue = events(harness)[0];
		harness.game.startBackgroundWork();
		await vi.waitFor(() => expect(entries(harness, harness.botId)).toHaveLength(1));
		const [entry] = entries(harness, harness.botId);
		expect(entry).toMatchObject({
			opportunity: 'clue',
			notes: null,
			explanation: `Decision summary for ${harness.botId}.`,
			observedAt: { eventId: clue.eventId, sequence: 1, turnIndex: 1 },
			recordedAt: { eventId: clue.eventId, sequence: 1, turnIndex: 1 },
			sourceClueEventIds: [clue.eventId],
		});
		const after = snapshot(harness.game).data;
		expect(chats(harness)).toEqual([
			expect.objectContaining({
				id: entry.decisionId,
				playerId: harness.botId,
				message: `Debug: ${entry.explanation}`,
			}),
		]);
		expect({ ...after, actions: after.actions.slice(0, -1) }).toEqual(before);
		expect(events(harness)).toHaveLength(1);
		expect(snapshot(harness.game).botRound?.pendingClues).toEqual([]);
		await settle();
		expect(harness.chooseAction).toHaveBeenCalledOnce();
	});

	it('isolates each bot notepad and makes an accepted entry available to its next request', async () => {
		const harness = seeded({ botStarts: true, secondBot: true });
		const ownNotes = `Private note for ${harness.botId}`;
		const otherNotes = `Private note for ${harness.secondBotId!}`;
		harness.chooseAction.mockImplementation((request) =>
			Promise.resolve(
				reply(request, request.observation.playerId === harness.botId ? ownNotes : otherNotes),
			),
		);
		harness.game.startBackgroundWork();
		await vi.waitFor(() => expect(snapshot(harness.game).data.currentPlayerId).toBe('host'));
		expect(harness.chooseAction).toHaveBeenCalledTimes(2);
		expect(harness.chooseAction.mock.calls[0][0].notepad).toEqual({ version: 1, entries: [] });
		expect(harness.chooseAction.mock.calls[1][0].notepad).toEqual({ version: 1, entries: [] });
		const firstEntry = entries(harness, harness.botId)[0];
		giveClue(harness, harness.botId);
		await vi.waitFor(() => expect(entries(harness, harness.botId)).toHaveLength(2));
		const third = harness.chooseAction.mock.calls[2][0];
		expect(third.notepad).toEqual({ version: 1, entries: [firstEntry] });
		expect(JSON.stringify(third.notepad)).not.toContain(otherNotes);
		expect(entries(harness, harness.secondBotId!)).toHaveLength(1);
		expect(entries(harness, harness.botId)[0]).toEqual(firstEntry);
	});

	it('restores accepted entries and continues the append-only sequence after hydration', async () => {
		const original = seeded({ botStarts: true });
		original.chooseAction.mockImplementation((request) =>
			Promise.resolve(reply(request, 'Remember the first turn.')),
		);
		original.game.startBackgroundWork();
		await vi.waitFor(() => expect(entries(original, original.botId)).toHaveLength(1));
		await original.game.flushSaves();
		const saved = snapshot(original.game);
		original.game.cleanUp();
		const restored = createHarness(saved);
		expect(restored.chooseAction).not.toHaveBeenCalled();
		giveClue(restored, original.botId);
		restored.game.startBackgroundWork();
		await vi.waitFor(() => expect(entries(restored, original.botId)).toHaveLength(2));
		expect(restored.chooseAction.mock.calls[0][0].notepad).toEqual(
			saved.botRound!.notepads![original.botId],
		);
		expect(entries(restored, original.botId)[0]).toEqual(
			saved.botRound!.notepads![original.botId].entries[0],
		);
		expect(entries(restored, original.botId)[1].decisionId).not.toBe(
			entries(restored, original.botId)[0].decisionId,
		);
	});

	it('starts a fresh notepad after resetting the round while preserving the bot seat', async () => {
		const harness = seeded({ botStarts: true });
		harness.chooseAction.mockImplementation((request) =>
			Promise.resolve(reply(request, 'Old-round memory must disappear.')),
		);
		harness.game.startBackgroundWork();
		await vi.waitFor(() => expect(entries(harness, harness.botId)).toHaveLength(1));
		harness.game.stopBackgroundWork();
		send(harness, 'host', 'ResetGameMessage', undefined);
		send(harness, 'host', 'StartGameMessage', undefined);
		expect(snapshot(harness.game).botRound?.notepads).toEqual({});
		expect(snapshot(harness.game).data.players[harness.botId].kind).toBe('bot');
		expect(harness.game.serialize()).not.toContain('Old-round memory must disappear.');
	});

	it.each(['oversized', 'non-string', 'missing'] as const)(
		'rejects %s notes atomically before arrangement, action, memory, or debug chat',
		async (invalid) => {
			const harness = seeded({ botStarts: true });
			harness.chooseAction.mockImplementation((request) => {
				const own = request.observation.players.find(({ id }) => id === harness.botId)!;
				const result: Record<string, unknown> = {
					...reply(request),
					arrangement: {
						orderedRow: own.hand.map(({ tileId }) => tileId).reverse(),
						lowerArea: [],
					},
				};
				if (invalid === 'oversized') result.notes = 'x'.repeat(8001);
				if (invalid === 'non-string') result.notes = { private: true };
				if (invalid === 'missing') delete result.notes;
				return Promise.resolve(result as unknown as BotDecision);
			});
			const before = snapshot(harness.game);
			harness.game.startBackgroundWork();
			await vi.waitFor(() =>
				expect(snapshot(harness.game).botRound?.failure).toBe('invalid_action'),
			);
			expect(snapshot(harness.game).data).toEqual(before.data);
			expect(snapshot(harness.game).botRound?.history).toEqual(before.botRound?.history);
			expect(snapshot(harness.game).botRound?.notepads).toEqual({});
			expect(chats(harness)).toEqual([]);
			expect(consoleLog).not.toHaveBeenCalled();
		},
	);

	it('does not append a late clue response after reset', async () => {
		const harness = seeded();
		const pending = deferred();
		harness.chooseAction.mockReturnValue(pending.promise);
		giveClue(harness, harness.botId);
		harness.game.startBackgroundWork();
		await vi.waitFor(() => expect(harness.chooseAction).toHaveBeenCalledOnce());
		const request = harness.chooseAction.mock.calls[0][0];
		send(harness, 'host', 'ResetGameMessage', undefined);
		pending.resolve(reply(request, 'This late note must not survive.'));
		await settle();
		expect(request.signal.aborted).toBe(true);
		expect(snapshot(harness.game).botRound).toBeUndefined();
		expect(harness.game.serialize()).not.toContain('This late note must not survive.');
		expect(chats(harness)).toEqual([]);
		expect(consoleLog).not.toHaveBeenCalled();
	});

	it('publishes the explanation once as bot chat while keeping notes private and gameplay transcripts unchanged', async () => {
		const harness = seeded({ botStarts: true });
		const notes = 'Private prediction: the host may hold a red two.';
		const explanation = 'The host can use this clue to identify a playable card.';
		harness.chooseAction.mockImplementation((request) =>
			Promise.resolve({ ...reply(request, notes), explanation }),
		);
		harness.game.startBackgroundWork();
		await vi.waitFor(() => expect(entries(harness, harness.botId)).toHaveLength(1));
		await harness.game.flushSaves();
		const entry = entries(harness, harness.botId)[0];
		const chat = {
			id: entry.decisionId,
			type: HanabiGameActionType.Chat,
			playerId: harness.botId,
			message: `Debug: ${explanation}`,
		};
		expect(chats(harness)).toEqual([expect.objectContaining(chat)]);
		expect(harness.saved.at(-1)?.data.actions.at(-1)).toMatchObject(chat);
		const broadcasts = harness.sockets.sent.filter(
			({ message }) => message.type === 'RefreshGameDataMessage',
		);
		expect(
			broadcasts.some(
				({ message }) =>
					message.type === 'RefreshGameDataMessage' &&
					message.data.actions.some((action) => action.id === entry.decisionId),
			),
		).toBe(true);
		const visible = JSON.stringify(harness.sockets.sent);
		expect(visible).toContain(`Debug: ${explanation}`);
		expect(visible).not.toContain(notes);
		expect(visible).not.toContain('"notepads"');
		expect(visible).not.toContain('"privateNotepad"');
		const replay = JSON.stringify({
			history: snapshot(harness.game).botRound?.history,
			transcript: snapshot(harness.game).transcript,
		});
		expect(replay).not.toContain(notes);
		expect(replay).not.toContain(explanation);
		harness.game.startBackgroundWork();
		await settle();
		expect(entries(harness, harness.botId)).toHaveLength(1);
		expect(chats(harness)).toHaveLength(1);
		expect(consoleLog).not.toHaveBeenCalled();
	});

	it('preserves a maximum-length explanation in one chat through save and hydration without widening human chat limits', async () => {
		const harness = seeded({ botStarts: true });
		const explanation = 'a'.repeat(1000);
		harness.chooseAction.mockImplementation((request) =>
			Promise.resolve({ ...reply(request), explanation }),
		);
		harness.game.startBackgroundWork();
		await vi.waitFor(() => expect(entries(harness, harness.botId)).toHaveLength(1));
		await harness.game.flushSaves();
		const saved = snapshot(harness.game);
		harness.game.cleanUp();
		const restored = createHarness(saved);
		expect(chats(restored)).toEqual(chats(harness));
		expect(chats(restored)).toHaveLength(1);
		expect(chats(restored)[0].message).toBe(`Debug: ${explanation}`);
		expect(chats(restored)[0].message).toHaveLength(1007);
		send(restored, 'host', 'SendChatMessage', `Debug: ${explanation}`);
		expect(response(restored, 'SendChatResponseMessage').error).toBeTruthy();
		expect(chats(restored)).toHaveLength(1);
		const forged = structuredClone(saved);
		const savedChat = forged.data.actions.at(-1)!;
		if (savedChat.type !== HanabiGameActionType.Chat) throw new Error('Expected debug chat.');
		savedChat.playerId = 'host';
		expect(() => createHarness(forged)).toThrow();
		savedChat.playerId = harness.botId;
		savedChat.message = explanation;
		expect(() => createHarness(forged)).toThrow();
		restored.game.startBackgroundWork();
		await settle();
		expect(restored.chooseAction).not.toHaveBeenCalled();
		expect(chats(restored)).toHaveLength(1);
	});

	it('passes a private copy so a provider cannot rewrite prior accepted entries', async () => {
		const harness = seeded({ botStarts: true });
		harness.chooseAction.mockImplementationOnce((request) =>
			Promise.resolve(reply(request, 'Keep this original entry.')),
		);
		harness.game.startBackgroundWork();
		await vi.waitFor(() => expect(entries(harness, harness.botId)).toHaveLength(1));
		const first = entries(harness, harness.botId)[0];
		harness.chooseAction.mockImplementation((request) => {
			request.notepad!.entries[0].notes = 'Attempted mutation of history.';
			return Promise.resolve(reply(request));
		});
		giveClue(harness, harness.botId);
		await vi.waitFor(() => expect(entries(harness, harness.botId)).toHaveLength(2));
		expect(entries(harness, harness.botId)[0]).toEqual(first);
		expect(harness.game.serialize()).not.toContain('Attempted mutation of history.');
	});

	it('preserves a saved v2 policy without notepad support and accepts its three-field response', async () => {
		const original = seeded({ botStarts: true });
		const saved = snapshot(original.game);
		const policy = saved.botRound!.policy;
		const legacyPolicy = {
			model: policy.model,
			instructions:
				'Saved v2 contract: choose one legal action, optional arrangement, and explanation.',
			reasoningEffort: policy.reasoningEffort,
			contractVersion: policy.contractVersion,
			arrangementAfterClue: policy.arrangementAfterClue,
			rules: policy.rules,
			conventions: policy.conventions,
			conventionsVersion: policy.conventionsVersion,
		};
		const hash = createHash('sha256')
			.update(
				JSON.stringify(legacyPolicy, (_key, value: unknown) =>
					value && typeof value === 'object' && !Array.isArray(value)
						? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)))
						: value,
				),
			)
			.digest('hex');
		saved.botRound!.policy = { ...legacyPolicy, hash };
		delete saved.botRound!.notepads;
		original.game.cleanUp();
		const restored = createHarness(saved);
		restored.chooseAction.mockImplementation((request) => {
			const result = reply(request);
			delete result.notes;
			return Promise.resolve(result);
		});
		restored.game.startBackgroundWork();
		await vi.waitFor(() => expect(snapshot(restored.game).data.currentPlayerId).toBe('host'));
		expect(restored.chooseAction.mock.calls[0][0]).not.toHaveProperty('notepad');
		expect(snapshot(restored.game).botRound?.notepads).toBeUndefined();
		expect(snapshot(restored.game).botRound?.policy).toEqual(saved.botRound!.policy);
		expect(chats(restored)).toEqual([
			expect.objectContaining({
				playerId: original.botId,
				message: `Debug: Decision summary for ${original.botId}.`,
			}),
		]);
	});
});
