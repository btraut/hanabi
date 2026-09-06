import { getScope, HanabiGameActionType, PubSub, type HanabiMessage } from '@hanabi/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
const startupPolicy = createBotPolicy('test-model', 'Follow the agreed conventions.');

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

function reply(request: BotDecisionRequest): BotDecision {
	const action =
		request.legalActions.find(({ action }) => action.type === 'clue' && action.to === 'host') ??
		request.legalActions.find(({ action }) => action.type === 'clue');
	return {
		actionId: request.opportunity === 'clue' ? null : action!.id,
		arrangement: null,
		explanation: `Decision summary for ${request.observation.playerId}.`,
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
	};
	saved.transcript = createGameTranscript(
		{ gameId: saved.id, gameCode: saved.code },
		data,
		saved.updated,
	);
	initial.game.cleanUp();
	return { ...createHarness(saved), botId, secondBotId };
}

function chats(harness: Harness) {
	return snapshot(harness.game).data.actions.filter(
		(action) => action.type === HanabiGameActionType.Chat,
	);
}

async function settle() {
	await new Promise((resolve) => setTimeout(resolve, 10));
}

describe('bot explanations', () => {
	it('publishes the explanation once as bot chat and keeps gameplay transcripts unchanged', async () => {
		const harness = seeded({ botStarts: true });
		const explanation = 'The host can use this clue to identify a playable card.';
		harness.chooseAction.mockImplementation((request) =>
			Promise.resolve({ ...reply(request), explanation }),
		);
		harness.game.startBackgroundWork();
		await vi.waitFor(() => expect(chats(harness)).toHaveLength(1));
		await harness.game.flushSaves();
		const decisionId = chats(harness)[0].id;
		const chat = {
			id: decisionId,
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
					message.data.actions.some((action) => action.id === decisionId),
			),
		).toBe(true);
		const visible = JSON.stringify(harness.sockets.sent);
		expect(visible).toContain(`Debug: ${explanation}`);
		expect(visible).not.toContain('"notepads"');
		expect(visible).not.toContain('"privateNotepad"');
		const replay = JSON.stringify({
			history: snapshot(harness.game).botRound?.history,
			transcript: snapshot(harness.game).transcript,
		});
		expect(replay).not.toContain(explanation);
		harness.game.startBackgroundWork();
		await settle();
		expect(chats(harness)).toHaveLength(1);
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
		await vi.waitFor(() => expect(chats(harness)).toHaveLength(1));
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

	it('starts rounds and submits decisions without scratchpad state', async () => {
		const harness = seeded({ botStarts: true });
		harness.game.startBackgroundWork();
		await vi.waitFor(() => expect(chats(harness)).toHaveLength(1));
		expect(harness.chooseAction.mock.calls[0][0]).not.toHaveProperty('notepad');
		expect(snapshot(harness.game).botRound).not.toHaveProperty('notepads');
		expect(snapshot(harness.game).botRound?.policy).not.toHaveProperty('notepadVersion');
		expect(snapshot(harness.game).transcript?.moves).toHaveLength(1);
	});
});
