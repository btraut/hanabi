import {
	getHanabiHandLayout,
	getHanabiPositionsForLayout,
	getScope,
	HanabiFinishedReason,
	HanabiGameActionType,
	HanabiStage,
	PubSub,
	type HanabiHandLayout,
	type HanabiMessage,
	type HanabiRuleSet,
} from '@hanabi/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type ServerSocketManager from '../../utils/SocketManager.js';
import type { SaveGameDelegate } from '../server/GameStore.js';
import { createGameTranscript } from './GameTranscript.js';
import type HanabiGame from './HanabiGame.js';
import type { HanabiGameSerialized } from './HanabiGame.js';
import HanabiGameFactory from './HanabiGameFactory.js';
import { createBotHistory } from './bots/BotHistory.js';
import { buildBotObservation } from './bots/BotObservation.js';
import { createBotPolicy, createRoundBotPolicy, type BotPolicy } from './bots/BotPolicy.js';
import { BotRuntime } from './bots/BotRuntime.js';
import { MAX_BOT_INPUT_BYTES } from './bots/BotTurnCoordinator.js';
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
const startupPolicy = createBotPolicy('test-model', 'Consider clues; arrangements are optional.');
function createConsoleLogSpy() {
	return vi.spyOn(console, 'log').mockImplementation(() => undefined);
}

let consoleLog: ReturnType<typeof createConsoleLogSpy>;

beforeEach(() => {
	consoleLog = createConsoleLogSpy();
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

function decision(
	request: BotDecisionRequest,
	arrangement: HanabiHandLayout | null = null,
): BotDecision {
	const action = request.legalActions.find(({ action }) => action.type === 'clue');
	return {
		actionId: request.opportunity && request.opportunity !== 'turn' ? null : action!.id,
		arrangement,
		explanation: 'Keep the current queue until stronger evidence arrives.',
		...(request.policy.notepadVersion === 1 ? { notes: null } : {}),
		inputTokens: 10,
		outputTokens: 5,
	};
}

function createHarness(serialized?: HanabiGameSerialized) {
	const sockets = new FakeSocketManager();
	const saved: HanabiGameSerialized[] = [];
	const saveGame = vi.fn<SaveGameDelegate['saveGame']>().mockImplementation((game) => {
		saved.push(snapshot(game as HanabiGame));
		return Promise.resolve();
	});
	const saveDelegate: SaveGameDelegate = {
		saveGame,
		deleteGame: vi.fn().mockResolvedValue(undefined),
	};
	const chooseAction = vi
		.fn<BotDecisionProvider['chooseAction']>()
		.mockImplementation((request) => Promise.resolve(decision(request)));
	const runtime = new BotRuntime({ chooseAction }, startupPolicy);
	const factory = new HanabiGameFactory(2, false, undefined, runtime);
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
	const message = [...harness.sockets.sent]
		.reverse()
		.find((sent) => sent.recipients === userId && sent.message.type === type);
	if (!message) throw new Error(`Missing ${type} for ${userId}.`);
	return message.message.data as Payloads[Type];
}

/** Rebuild the initial deal checkpoint after fixing turn order; all hands come from a real dealt deck. */
function seeded(
	options: {
		botStarts?: boolean;
		botNext?: boolean;
		legacy?: boolean;
		dragging?: boolean;
		finalTurn?: boolean;
		humanCount?: 2 | 3 | 4;
		ruleSet?: HanabiRuleSet;
		seed?: string;
		policy?: BotPolicy;
		secondBot?: boolean;
		secondBotNext?: boolean;
	} = {},
) {
	let initial = createHarness();
	send(initial, 'host', 'AddPlayerMessage', { name: 'Host' });
	send(initial, 'guest', 'AddPlayerMessage', { name: 'Guest' });
	const humanIds = ['host', 'guest'];
	for (let index = 2; index < (options.humanCount ?? 2); index += 1) {
		const playerId = `human-${index}`;
		send(initial, playerId, 'AddPlayerMessage', { name: `Human ${index}` });
		humanIds.push(playerId);
	}
	send(initial, 'host', 'AddBotMessage', undefined);
	const botId = response(initial, 'AddBotResponseMessage').playerId!;
	let secondBotId: string | undefined;
	if (options.secondBot) {
		send(initial, 'host', 'AddBotMessage', undefined);
		secondBotId = response(initial, 'AddBotResponseMessage').playerId!;
	}
	if (options.ruleSet) {
		send(initial, 'host', 'ChangeGameSettingsMessage', { ruleSet: options.ruleSet });
	}
	if (options.seed) {
		const setup = snapshot(initial.game);
		setup.data.seed = options.seed;
		initial.game.cleanUp();
		initial = createHarness(setup);
	}
	send(initial, 'host', 'StartGameMessage', undefined);
	const saved = snapshot(initial.game);
	const data = saved.data;
	data.turnOrder = secondBotId
		? options.secondBotNext
			? ['host', secondBotId, ...humanIds.slice(1), botId]
			: [...humanIds, secondBotId, botId]
		: options.botNext
			? ['host', botId, ...humanIds.slice(1)]
			: [...humanIds, botId];
	data.currentPlayerId = options.botStarts ? botId : 'host';
	data.allowDragging = options.dragging ?? true;
	data.criticalGameOver = false;
	data.clues = 6;
	data.actions = data.actions.map((action) =>
		action.type === HanabiGameActionType.GameStarted
			? { ...action, startingPlayerId: data.currentPlayerId! }
			: action,
	);
	if (options.finalTurn) {
		data.discardedTiles = [...data.discardedTiles, ...data.remainingTiles];
		data.remainingTiles = [];
		data.remainingTurns = 1;
	}
	saved.botRound = {
		version: options.legacy ? 1 : 2,
		roundId: data.seed,
		policy: options.legacy
			? (options.policy ?? startupPolicy)
			: createRoundBotPolicy(options.policy ?? startupPolicy, data),
		history: options.legacy ? createBotHistory(data) : createBotHistory(data, 2),
		revision: 0,
		attempts: 0,
		tokens: 0,
		status: 'ready',
		lastAttemptAt: 0,
		...(options.legacy ? {} : { pendingClues: [] }),
	};
	saved.transcript = createGameTranscript(
		{ gameId: saved.id, gameCode: saved.code },
		data,
		saved.updated,
	);
	initial.game.cleanUp();
	const harness = createHarness(saved);
	return { ...harness, botId, secondBotId };
}

type SeededHarness = ReturnType<typeof seeded>;

function giveBotClue(harness: SeededHarness, actorId = 'host') {
	const data = snapshot(harness.game).data;
	send(harness, actorId, 'GiveClueMessage', {
		to: harness.botId,
		number: data.tiles[data.playerTiles[harness.botId][0]].number,
	});
	expect(response(harness, 'GiveClueResponseMessage', actorId).error).toBeUndefined();
}

function historyEvents(harness: Harness) {
	const history = snapshot(harness.game).botRound!.history;
	if (history.version !== 2) throw new Error('Expected complete v2 history.');
	return history.events;
}

function reverseLayout(request: BotDecisionRequest): HanabiHandLayout {
	const ownHand = request.observation.players.find(
		({ id }) => id === request.observation.playerId,
	)!.hand;
	return { orderedRow: ownHand.map(({ tileId }) => tileId).reverse(), lowerArea: [] };
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

async function waitForClueResponse(harness: Harness) {
	await vi.waitFor(() => {
		expect(harness.chooseAction).toHaveBeenCalledOnce();
		expect(snapshot(harness.game).botRound?.pendingClues).toEqual([]);
	});
	await settle();
}

function decisionChats(harness: Harness) {
	return snapshot(harness.game).data.actions.filter(
		(action) => action.type === HanabiGameActionType.Chat,
	);
}

describe('bot turn and clue decision opportunities', () => {
	it('starts new rounds with the enriched contract before background inference begins', () => {
		const harness = createHarness();
		send(harness, 'host', 'AddPlayerMessage', { name: 'Host' });
		send(harness, 'host', 'AddBotMessage', undefined);
		send(harness, 'host', 'StartGameMessage', undefined);
		expect(snapshot(harness.game).botRound).toMatchObject({
			version: 2,
			policy: { contractVersion: 2, reasoningEffort: 'medium' },
			history: { version: 2 },
			pendingClues: [],
		});
		expect(harness.chooseAction).not.toHaveBeenCalled();
	});

	it('offers a clue response immediately without moving cards until the model accepts', async () => {
		const harness = seeded();
		const pending = deferred();
		harness.chooseAction.mockReturnValue(pending.promise);
		harness.game.startBackgroundWork();
		const before = snapshot(harness.game).data;
		giveBotClue(harness);
		const afterClue = snapshot(harness.game).data;
		const transcriptAfterClue = snapshot(harness.game).transcript;
		expect(afterClue.tilePositions).toEqual(before.tilePositions);
		await vi.waitFor(() => expect(harness.chooseAction).toHaveBeenCalledOnce());
		const request = harness.chooseAction.mock.calls[0][0];
		expect(request).toMatchObject({
			opportunity: 'clue',
			legalActions: [],
			sourceClueEventIds: [historyEvents(harness)[0].eventId],
		});
		expect(request.observation.currentPlayerId).toBe('guest');
		expect(snapshot(harness.game).data).toEqual(afterClue);
		pending.resolve(decision(request));
		await waitForClueResponse(harness);
		const afterResponse = snapshot(harness.game).data;
		expect(decisionChats(harness)).toEqual([
			expect.objectContaining({
				playerId: harness.botId,
				message: `Debug: ${decision(request).explanation}`,
			}),
		]);
		expect({ ...afterResponse, actions: afterResponse.actions.slice(0, -1) }).toEqual(afterClue);
		expect(historyEvents(harness).map(({ type }) => type)).toEqual(['clue']);
		expect(snapshot(harness.game).transcript).toEqual(transcriptAfterClue);
	});

	it('allows a clued bot to reorder the queue without forcing touched cards below', async () => {
		const harness = seeded();
		harness.chooseAction.mockImplementation((request) =>
			Promise.resolve(decision(request, reverseLayout(request))),
		);
		giveBotClue(harness);
		const before = snapshot(harness.game);
		harness.game.startBackgroundWork();
		await waitForClueResponse(harness);
		const after = snapshot(harness.game);
		const layout = getHanabiHandLayout(
			after.data.playerTiles[harness.botId],
			after.data.tilePositions,
		);
		expect(layout).toEqual({
			orderedRow: [...before.data.playerTiles[harness.botId]].reverse(),
			lowerArea: [],
		});
		expect(decisionChats(harness)).toHaveLength(1);
		expect({
			...after.data,
			actions: after.data.actions.slice(0, -1),
			tilePositions: before.data.tilePositions,
		}).toEqual(before.data);
		expect(historyEvents(harness).map(({ type }) => type)).toEqual(['clue', 'arrangement']);
		expect(historyEvents(harness)[1]).toMatchObject({
			turnIndex: 1,
			sourceClueEventId: historyEvents(harness)[0].eventId,
		});
		expect(after.transcript?.moves).toEqual(before.transcript?.moves);
		expect(after.transcript?.revision).toBe(before.transcript!.revision + 1);
		expect(after.transcript?.handMovements).toEqual([
			expect.objectContaining({
				actorId: harness.botId,
				afterMoveIndex: 1,
			}),
		]);
		expect({
			...before.data.tilePositions,
			...after.transcript!.handMovements![0].positions,
		}).toEqual(after.data.tilePositions);
		expect(harness.chooseAction).toHaveBeenCalledOnce();
	});

	it('rejects an off-turn gameplay action without applying its otherwise valid arrangement or posting debug chat', async () => {
		const harness = seeded();
		harness.chooseAction.mockImplementation((request) =>
			Promise.resolve({
				...decision(request, reverseLayout(request)),
				actionId: 'action-0',
			}),
		);
		giveBotClue(harness);
		const before = snapshot(harness.game);
		harness.game.startBackgroundWork();
		await vi.waitFor(() => expect(snapshot(harness.game).botRound?.failure).toBe('invalid_action'));
		expect(snapshot(harness.game).data).toEqual(before.data);
		expect(snapshot(harness.game).botRound?.history).toEqual(before.botRound?.history);
		expect(snapshot(harness.game).transcript).toEqual(before.transcript);
		expect(decisionChats(harness)).toEqual([]);
	});

	it.each(['play', 'discard', 'clue'] as const)(
		'combines an arrangement with one %s turn using stable card IDs',
		async (type) => {
			const harness = seeded({ botStarts: true });
			harness.chooseAction.mockImplementation((request) =>
				Promise.resolve(
					request.opportunity === 'result'
						? decision(request)
						: {
								...decision(request, reverseLayout(request)),
								actionId: request.legalActions.find(({ action }) => action.type === type)!.id,
							},
				),
			);
			const before = snapshot(harness.game);
			harness.game.startBackgroundWork();
			await vi.waitFor(() => expect(snapshot(harness.game).data.currentPlayerId).toBe('host'));
			await settle();
			const after = snapshot(harness.game);
			expect(harness.chooseAction).toHaveBeenCalledTimes(type === 'clue' ? 1 : 2);
			expect(harness.chooseAction.mock.calls[0][0].opportunity).toBe('turn');
			if (type !== 'clue') expect(harness.chooseAction.mock.calls[1][0].opportunity).toBe('result');
			expect(historyEvents(harness).map(({ type }) => type)).toEqual(['arrangement', type]);
			expect(after.botRound?.history.moves).toHaveLength(1);
			expect(after.transcript?.moves).toHaveLength(1);
			expect(after.transcript?.revision).toBe(before.transcript!.revision + 2);
			expect(after.transcript?.handMovements).toEqual([
				expect.objectContaining({
					actorId: harness.botId,
					afterMoveIndex: 0,
				}),
			]);
			expect({
				...before.data.tilePositions,
				...after.transcript!.handMovements![0].positions,
			}).toEqual({
				...before.data.tilePositions,
				...getHanabiPositionsForLayout(
					before.data.playerTiles[harness.botId],
					reverseLayout(harness.chooseAction.mock.calls[0][0]),
				),
			});
			expect(after.transcript?.moves[0].postTurn.tilePositions).toEqual(after.data.tilePositions);
			expect(after.data.clues).toBe(
				before.data.clues + (type === 'discard' ? 1 : type === 'clue' ? -1 : 0),
			);
			if (type !== 'clue') {
				const action = harness.chooseAction.mock.calls[0][0].legalActions.find(
					({ action }) => action.type === type,
				)!.action;
				if (action.type === 'clue') throw new Error('Expected a card action.');
				expect(after.data.playerTiles[harness.botId]).not.toContain(action.tileId);
				expect(after.data.remainingTiles.length).toBe(before.data.remainingTiles.length - 1);
			}
		},
	);

	it('combines a received clue with the immediately following bot turn in one request', async () => {
		const harness = seeded({ botNext: true });
		giveBotClue(harness);
		harness.game.startBackgroundWork();
		await vi.waitFor(() => expect(snapshot(harness.game).data.currentPlayerId).toBe('guest'));
		await settle();
		expect(harness.chooseAction).toHaveBeenCalledOnce();
		expect(harness.chooseAction.mock.calls[0][0]).toMatchObject({
			opportunity: 'turn',
			sourceClueEventIds: [historyEvents(harness)[0].eventId],
		});
		expect(snapshot(harness.game).botRound?.pendingClues).toEqual([]);
		expect(historyEvents(harness).map(({ type }) => type)).toEqual(['clue', 'clue']);
	});

	it('coalesces clues received before inference and preserves both source events', async () => {
		const harness = seeded();
		giveBotClue(harness);
		giveBotClue(harness, 'guest');
		const sourceIds = historyEvents(harness).map(({ eventId }) => eventId);
		expect(snapshot(harness.game).botRound?.pendingClues).toEqual([
			{ playerId: harness.botId, eventIds: sourceIds },
		]);
		harness.game.startBackgroundWork();
		await vi.waitFor(() => expect(snapshot(harness.game).data.currentPlayerId).toBe('host'));
		await settle();
		expect(harness.chooseAction).toHaveBeenCalledOnce();
		expect(harness.chooseAction.mock.calls[0][0]).toMatchObject({
			opportunity: 'turn',
			sourceClueEventIds: sourceIds,
		});
	});

	it('retains v1 action-only behavior and schedules no off-turn clue inference', async () => {
		const harness = seeded({ legacy: true });
		harness.game.startBackgroundWork();
		giveBotClue(harness);
		await settle();
		expect(harness.chooseAction).not.toHaveBeenCalled();
		expect(snapshot(harness.game).botRound?.history.version).toBe(1);
		expect(snapshot(harness.game).botRound?.pendingClues).toBeUndefined();
	});

	it('keeps legacy action-only turns free of invented explanations', async () => {
		const harness = seeded({ legacy: true, botStarts: true });
		harness.chooseAction.mockImplementation((request) =>
			Promise.resolve({ actionId: request.legalActions[0].id }),
		);
		harness.game.startBackgroundWork();
		await vi.waitFor(() => expect(snapshot(harness.game).data.currentPlayerId).toBe('host'));
		expect(harness.chooseAction).toHaveBeenCalledOnce();
		expect(decisionChats(harness)).toEqual([]);
	});

	it('disables clue arrangement invitations when dragging is disabled and rejects an own-turn arrangement', async () => {
		const harness = seeded({ dragging: false });
		harness.game.startBackgroundWork();
		giveBotClue(harness);
		await settle();
		expect(harness.chooseAction).not.toHaveBeenCalled();
		harness.chooseAction.mockImplementation((request) =>
			Promise.resolve(decision(request, reverseLayout(request))),
		);
		giveBotClue(harness, 'guest');
		const before = snapshot(harness.game);
		await vi.waitFor(() => expect(snapshot(harness.game).botRound?.failure).toBe('invalid_action'));
		expect(snapshot(harness.game).data).toEqual(before.data);
		expect(decisionChats(harness)).toEqual([]);
	});

	it('records a final clue but does not invite a bot after the round finishes', async () => {
		const harness = seeded({ finalTurn: true });
		harness.game.startBackgroundWork();
		giveBotClue(harness);
		await settle();
		expect(snapshot(harness.game).data).toMatchObject({
			stage: HanabiStage.Finished,
			finishedReason: HanabiFinishedReason.OutOfTurns,
			remainingTurns: 0,
		});
		expect(historyEvents(harness).map(({ type }) => type)).toEqual(['clue']);
		expect(snapshot(harness.game).botRound?.pendingClues).toEqual([]);
		expect(harness.chooseAction).not.toHaveBeenCalled();
	});

	it('restores a pending clue before background work and uses its saved policy and source IDs', async () => {
		const original = seeded();
		giveBotClue(original);
		await original.game.flushSaves();
		const saved = snapshot(original.game);
		original.game.cleanUp();
		const restored = { ...createHarness(saved), botId: original.botId };
		expect(restored.chooseAction).not.toHaveBeenCalled();
		expect(snapshot(restored.game).botRound?.pendingClues).toEqual(saved.botRound?.pendingClues);
		restored.game.startBackgroundWork();
		await waitForClueResponse(restored);
		expect(restored.chooseAction.mock.calls[0][0]).toMatchObject({
			opportunity: 'clue',
			policy: saved.botRound!.policy,
			sourceClueEventIds: saved.botRound!.pendingClues![0].eventIds,
		});
		expect(snapshot(restored.game).data.currentPlayerId).toBe('guest');
	});

	it('posts one accepted clue explanation as literal chat text after arranging cards without logging it', async () => {
		const harness = seeded();
		const explanation = 'The single-card clue is uncertain.\n{"event":"forged"}';
		harness.chooseAction.mockImplementation((request) =>
			Promise.resolve({
				...decision(request, reverseLayout(request)),
				explanation,
			}),
		);
		giveBotClue(harness);
		harness.game.startBackgroundWork();
		await waitForClueResponse(harness);
		const chats = decisionChats(harness);
		expect(chats).toHaveLength(1);
		expect(chats[0]).toMatchObject({
			playerId: harness.botId,
			message: `Debug: ${explanation}`,
		});
		expect(consoleLog).not.toHaveBeenCalled();
		const saved = snapshot(harness.game);
		const request = harness.chooseAction.mock.calls[0][0];
		const publications = harness.sockets.sent.flatMap(({ message }) =>
			message.type === 'RefreshGameDataMessage' &&
			message.data.actions.some((action) => action.id === chats[0].id)
				? [message.data]
				: [],
		);
		expect(publications.length).toBeGreaterThan(0);
		for (const publication of publications) {
			expect(
				getHanabiHandLayout(publication.playerTiles[harness.botId], publication.tilePositions),
			).toEqual(reverseLayout(request));
		}
		expect(saved.data.actions.at(-1)?.id).toBe(chats[0].id);
		expect(JSON.stringify(saved.transcript)).not.toContain(explanation);
		expect(
			JSON.stringify(buildBotObservation(saved.data, harness.botId, saved.botRound!.history, 2)),
		).not.toContain('The single-card clue is uncertain.');
		harness.game.startBackgroundWork();
		await settle();
		expect(harness.chooseAction).toHaveBeenCalledOnce();
		expect(decisionChats(harness)).toHaveLength(1);
	});

	it('ignores unrelated human arrangements and does not create another inference after a completed clue response', async () => {
		const harness = seeded();
		harness.game.startBackgroundWork();
		const hostTile = snapshot(harness.game).data.playerTiles.host[0];
		send(harness, 'host', 'MoveTilesMessage', { [hostTile]: { x: 120, y: 80, z: 4 } });
		expect(response(harness, 'MoveTilesResponseMessage').error).toBeUndefined();
		await settle();
		expect(harness.chooseAction).not.toHaveBeenCalled();
		giveBotClue(harness);
		await waitForClueResponse(harness);
		send(harness, 'host', 'MoveTilesMessage', { [hostTile]: { x: 130, y: 80, z: 4 } });
		await settle();
		expect(harness.chooseAction).toHaveBeenCalledOnce();
		expect(snapshot(harness.game).data.currentPlayerId).toBe('guest');
	});

	it('rejects a late decision after reset without moving cards or posting debug chat', async () => {
		const harness = seeded();
		const pending = deferred();
		harness.chooseAction.mockReturnValue(pending.promise);
		giveBotClue(harness);
		harness.game.startBackgroundWork();
		await vi.waitFor(() => expect(harness.chooseAction).toHaveBeenCalledOnce());
		const request = harness.chooseAction.mock.calls[0][0];
		send(harness, 'host', 'ResetGameMessage', undefined);
		const reset = snapshot(harness.game);
		pending.resolve(decision(request, reverseLayout(request)));
		await settle();
		expect(request.signal.aborted).toBe(true);
		expect(snapshot(harness.game).data).toEqual(reset.data);
		expect(snapshot(harness.game).transcript).toEqual(reset.transcript);
		expect(decisionChats(harness)).toEqual([]);
	});

	it('keeps a failed clue response paused through unrelated moves and turns, then accepts a fresh clue opportunity', async () => {
		const harness = seeded({ humanCount: 4 });
		harness.chooseAction.mockImplementationOnce((request) =>
			Promise.resolve({
				...decision(request),
				actionId: 'forbidden-off-turn-action',
			}),
		);
		giveBotClue(harness);
		harness.game.startBackgroundWork();
		await vi.waitFor(() => expect(snapshot(harness.game).botRound?.failure).toBe('invalid_action'));
		const hostData = snapshot(harness.game).data;
		const hostTile = hostData.playerTiles.host[0];
		send(harness, 'host', 'MoveTilesMessage', { [hostTile]: { x: 130, y: 80, z: 4 } });
		send(harness, 'guest', 'GiveClueMessage', {
			to: 'host',
			number: hostData.tiles[hostTile].number,
		});
		expect(response(harness, 'GiveClueResponseMessage', 'guest').error).toBeUndefined();
		await settle();
		expect(harness.chooseAction).toHaveBeenCalledOnce();
		expect(snapshot(harness.game).botRound).toMatchObject({
			status: 'error',
			failure: 'invalid_action',
		});
		expect(snapshot(harness.game).data.currentPlayerId).toBe('human-2');
		giveBotClue(harness, 'human-2');
		await vi.waitFor(() => {
			expect(harness.chooseAction).toHaveBeenCalledTimes(2);
			expect(snapshot(harness.game).botRound?.pendingClues).toEqual([]);
		});
		const request = harness.chooseAction.mock.calls[1][0];
		expect(request.opportunity).toBe('clue');
		expect(request.sourceClueEventIds).toHaveLength(2);
		expect(snapshot(harness.game).data.currentPlayerId).toBe('human-3');
		expect(snapshot(harness.game).botRound?.failure).toBeUndefined();
		expect(decisionChats(harness)).toHaveLength(1);
	});

	it('gives a bot its normal turn after a failed off-turn response when another human finishes playing', async () => {
		const harness = seeded();
		harness.chooseAction.mockImplementationOnce((request) =>
			Promise.resolve({
				...decision(request),
				actionId: 'forbidden-off-turn-action',
			}),
		);
		giveBotClue(harness);
		harness.game.startBackgroundWork();
		await vi.waitFor(() => expect(snapshot(harness.game).botRound?.failure).toBe('invalid_action'));
		const data = snapshot(harness.game).data;
		send(harness, 'guest', 'GiveClueMessage', {
			to: 'host',
			number: data.tiles[data.playerTiles.host[0]].number,
		});
		await vi.waitFor(() => expect(snapshot(harness.game).data.currentPlayerId).toBe('host'));
		expect(harness.chooseAction).toHaveBeenCalledTimes(2);
		expect(harness.chooseAction.mock.calls[1][0].opportunity).toBe('turn');
		expect(snapshot(harness.game).botRound?.pendingClues).toEqual([]);
		expect(snapshot(harness.game).botRound?.failure).toBeUndefined();
	});

	it.each([true, false])(
		'a failed optional response yields to another bot turn (already current: %s)',
		async (alreadyCurrent) => {
			const harness = seeded({ secondBot: true, secondBotNext: alreadyCurrent });
			const nextBot = deferred();
			harness.chooseAction.mockImplementation((request) =>
				request.observation.playerId === harness.botId
					? Promise.resolve({ ...decision(request), actionId: 'forbidden-off-turn-action' })
					: nextBot.promise,
			);
			const beforePositions = snapshot(harness.game).data.tilePositions;
			giveBotClue(harness);
			harness.game.startBackgroundWork();
			if (!alreadyCurrent) {
				await vi.waitFor(() =>
					expect(snapshot(harness.game).botRound?.failure).toBe('invalid_action'),
				);
				const data = snapshot(harness.game).data;
				send(harness, 'guest', 'GiveClueMessage', {
					to: 'host',
					number: data.tiles[data.playerTiles.host[0]].number,
				});
			}
			await vi.waitFor(() => expect(harness.chooseAction).toHaveBeenCalledTimes(2));
			expect(harness.chooseAction.mock.calls[1][0]).toMatchObject({
				opportunity: 'turn',
				observation: { playerId: harness.secondBotId },
			});
			expect(snapshot(harness.game).botRound?.pendingClues).toEqual([]);
			expect(snapshot(harness.game).data.tilePositions).toEqual(beforePositions);
			expect(decisionChats(harness)).toEqual([]);
		},
	);

	it('retains a fresh clue response when that clue advances play to another bot after an earlier failure', async () => {
		const harness = seeded({ secondBot: true });
		const nextBot = deferred();
		harness.chooseAction.mockImplementation((request) =>
			request.observation.playerId === harness.botId
				? Promise.resolve(decision(request))
				: nextBot.promise,
		);
		harness.chooseAction.mockImplementationOnce((request) =>
			Promise.resolve({
				...decision(request),
				actionId: 'forbidden-off-turn-action',
			}),
		);
		giveBotClue(harness);
		harness.game.startBackgroundWork();
		await vi.waitFor(() => expect(snapshot(harness.game).botRound?.failure).toBe('invalid_action'));
		giveBotClue(harness, 'guest');
		await vi.waitFor(() => expect(harness.chooseAction).toHaveBeenCalledTimes(3));
		expect(harness.chooseAction.mock.calls[1][0]).toMatchObject({
			opportunity: 'clue',
			observation: { playerId: harness.botId },
		});
		expect(harness.chooseAction.mock.calls[1][0].sourceClueEventIds).toHaveLength(2);
		expect(harness.chooseAction.mock.calls[2][0]).toMatchObject({
			opportunity: 'turn',
			observation: { playerId: harness.secondBotId },
		});
		expect(snapshot(harness.game).botRound?.pendingClues).toEqual([]);
		expect(historyEvents(harness).map(({ type }) => type)).toEqual(['clue', 'clue']);
	});

	it('fits a complete seven-suit five-player round with one arrangement per turn and restores its exact replay', async () => {
		const harness = seeded({
			humanCount: 4,
			ruleSet: 'rainbow-black-powder',
			seed: 'bot-full-round-payload-v2',
			policy: createBotPolicy(),
		});
		const requestSizes: number[] = [];
		harness.chooseAction.mockImplementation((request) => {
			requestSizes.push(
				Buffer.byteLength(
					JSON.stringify({ ...request.observation, privateNotepad: request.notepad }) +
						request.policy.instructions,
					'utf8',
				),
			);
			if (request.opportunity !== 'turn') return Promise.resolve(decision(request));
			const type = request.observation.clues < 8 ? 'discard' : 'clue';
			if (request.observation.version !== 2) throw new Error('Expected v2 observation.');
			const ownLayout = request.observation.players.find(({ id }) => id === harness.botId)!.layout;
			return Promise.resolve({
				...decision(request, { orderedRow: [...ownLayout.orderedRow].reverse(), lowerArea: [] }),
				actionId: request.legalActions.find(({ action }) => action.type === type)!.id,
			});
		});
		harness.game.startBackgroundWork();
		const settleBots = async () => {
			await vi.waitFor(
				() => {
					const state = snapshot(harness.game);
					expect(state.botRound?.failure).toBeUndefined();
					expect(state.botRound?.pendingResult).toBeUndefined();
					if (state.data.stage === HanabiStage.Finished) return;
					expect(state.botRound?.pendingClues).toEqual([]);
					expect(state.data.currentPlayerId).not.toBe(harness.botId);
				},
				{ interval: 1, timeout: 3000 },
			);
		};
		for (let turn = 0; turn < 200; turn += 1) {
			await settleBots();
			const { data } = snapshot(harness.game);
			if (data.stage === HanabiStage.Finished) break;
			const actorId = data.currentPlayerId!;
			const hand = data.playerTiles[actorId];
			const row = getHanabiHandLayout(hand, data.tilePositions).orderedRow.reverse();
			const positions = getHanabiPositionsForLayout(hand, { orderedRow: row, lowerArea: [] })!;
			send(harness, actorId, 'MoveTilesMessage', positions);
			expect(response(harness, 'MoveTilesResponseMessage', actorId).error).toBeUndefined();
			if (data.clues < 8) {
				send(harness, actorId, 'DiscardTileMessage', { id: row[0] });
				expect(response(harness, 'DiscardTileResponseMessage', actorId).error).toBeUndefined();
			} else {
				giveBotClue(harness, actorId);
			}
		}
		await settleBots();
		await harness.game.flushSaves();
		const finished = snapshot(harness.game);
		expect(finished.data).toMatchObject({
			stage: HanabiStage.Finished,
			finishedReason: HanabiFinishedReason.OutOfTurns,
			remainingTiles: [],
			remainingTurns: 0,
		});
		const history = finished.botRound!.history;
		if (history.version !== 2) throw new Error('Expected v2 history.');
		expect(history.moves.length).toBeGreaterThanOrEqual(100);
		expect(history.moves.length).toBeLessThan(200);
		expect(history.events.filter(({ type }) => type === 'arrangement')).toHaveLength(
			history.moves.length,
		);
		const finalObservation = buildBotObservation(finished.data, harness.botId, history, 2);
		const finalBytes = Buffer.byteLength(
			JSON.stringify({
				...finalObservation,
				privateNotepad: finished.botRound!.notepads?.[harness.botId],
			}) + finished.botRound!.policy.instructions,
			'utf8',
		);
		const peakBytes = Math.max(...requestSizes, finalBytes);
		expect(peakBytes).toBeLessThan(MAX_BOT_INPUT_BYTES);
		expect(finalObservation.history.events).toHaveLength(history.events.length);
		expect(finalObservation.history).toMatchObject({
			complete: true,
			turnHistoryComplete: true,
			layoutHistoryComplete: true,
		});

		const replayedHands = new Map(
			history.initialHands.map(({ playerId, cards }) => [
				playerId,
				cards.map(({ tileId, position }) => ({ tileId, position })),
			]),
		);
		let replayedState = history.initialState;
		for (const event of history.events) {
			if (event.type === 'arrangement') {
				expect(event.before).toEqual(replayedHands.get(event.actorId));
				replayedHands.set(event.actorId, event.after);
			} else {
				if (event.type === 'clue') expect(event.hand).toEqual(replayedHands.get(event.recipientId));
				else replayedHands.set(event.actorId, event.handAfter);
				replayedState = { ...replayedState, ...event.postTurn };
			}
		}
		for (const [playerId, hand] of replayedHands) {
			expect(hand).toEqual(
				finished.data.playerTiles[playerId].map((tileId) => ({
					tileId,
					position: finished.data.tilePositions[tileId],
				})),
			);
		}
		expect(replayedState).toMatchObject({
			currentPlayerId: finished.data.currentPlayerId,
			clues: finished.data.clues,
			lives: finished.data.lives,
			remainingTurns: 0,
			deckCount: 0,
			stage: HanabiStage.Finished,
			finishedReason: HanabiFinishedReason.OutOfTurns,
		});
		const restored = createHarness(finished);
		expect(snapshot(restored.game).data).toEqual(finished.data);
		expect(snapshot(restored.game).botRound).toEqual(finished.botRound);
		expect(
			buildBotObservation(
				snapshot(restored.game).data,
				harness.botId,
				snapshot(restored.game).botRound!.history,
				2,
			),
		).toEqual(finalObservation);
		process.stdout.write(
			`Full-round bot payload ${JSON.stringify({
				turns: history.moves.length,
				events: history.events.length,
				requests: requestSizes.length,
				peakBytes,
				finalBytes,
				limitBytes: MAX_BOT_INPUT_BYTES,
			})}\n`,
		);
	}, 20_000);
});
