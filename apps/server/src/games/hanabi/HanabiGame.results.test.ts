import {
	getHanabiHandLayout,
	getScope,
	HanabiGameActionType,
	HanabiStage,
	PubSub,
	type HanabiHandLayout,
	type HanabiMessage,
} from '@hanabi/shared';
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
	send = vi.fn<(_userId: string | readonly string[], message: HanabiMessage) => void>();
}

const games: HanabiGame[] = [];
const policy = createBotPolicy('test-model', 'Follow the agreed conventions.');

beforeEach(() => {
	vi.spyOn(console, 'log').mockImplementation(() => undefined);
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
	return {
		actionId:
			request.opportunity === 'turn'
				? request.legalActions.find(({ action }) => action.type === 'clue')!.id
				: null,
		arrangement,
		explanation: 'Interpret the revealed card and retain the current plan.',
		notes: null,
		inputTokens: 10,
		outputTokens: 5,
	};
}
function createHarness(serialized?: HanabiGameSerialized, maxConcurrent = 3) {
	const sockets = new FakeSocketManager();
	const saveDelegate: SaveGameDelegate = {
		saveGame: vi.fn().mockResolvedValue(undefined),
		deleteGame: vi.fn().mockResolvedValue(undefined),
	};
	const chooseAction = vi
		.fn<BotDecisionProvider['chooseAction']>()
		.mockImplementation((request) => Promise.resolve(decision(request)));
	const factory = new HanabiGameFactory(
		2,
		false,
		undefined,
		new BotRuntime({ chooseAction }, policy, { maxConcurrent }),
	);
	const game = serialized
		? factory.hydrate(
				JSON.stringify(serialized),
				sockets as unknown as ServerSocketManager,
				saveDelegate,
			)
		: factory.create('host', sockets as unknown as ServerSocketManager, saveDelegate);
	games.push(game);
	return { game, sockets, chooseAction };
}
type Harness = ReturnType<typeof createHarness>;
type Payloads = { [Message in HanabiMessage as Message['type']]: Message['data'] };
function send<Type extends HanabiMessage['type']>(
	harness: Harness,
	type: Type,
	data: Payloads[Type],
) {
	harness.sockets.onMessage.emit({
		userId: 'host',
		message: {
			scope: getScope(harness.game.title, harness.game.id),
			type,
			data,
		} as HanabiMessage,
	});
}

/** Use a real deterministic deal, then rebuild its initial checkpoints for a bot-first turn. */
function seeded(
	options: {
		dragging?: boolean;
		finalTurn?: boolean;
		secondBot?: boolean;
		maxConcurrent?: number;
	} = {},
) {
	const initial = createHarness();
	send(initial, 'AddPlayerMessage', { name: 'Host' });
	send(initial, 'AddBotMessage', undefined);
	if (options.secondBot) send(initial, 'AddBotMessage', undefined);
	const setup = snapshot(initial.game);
	setup.data.seed = 'result-reflections';
	initial.game.cleanUp();
	const dealt = createHarness(setup);
	send(dealt, 'StartGameMessage', undefined);
	const saved = snapshot(dealt.game);
	const data = saved.data;
	const [botId, secondBotId] = Object.values(data.players)
		.filter(({ kind }) => kind === 'bot')
		.map(({ id }) => id);
	data.turnOrder = secondBotId ? [botId, secondBotId, 'host'] : [botId, 'host'];
	data.currentPlayerId = botId;
	data.allowDragging = options.dragging ?? true;
	data.criticalGameOver = false;
	data.clues = 6;
	data.actions = data.actions.map((action) =>
		action.type === HanabiGameActionType.GameStarted
			? { ...action, startingPlayerId: botId }
			: action,
	);
	if (options.finalTurn) {
		data.discardedTiles = [...data.discardedTiles, ...data.remainingTiles];
		data.remainingTiles = [];
		data.remainingTurns = 1;
	}
	saved.botRound = {
		version: 2,
		roundId: data.seed,
		policy: createRoundBotPolicy(policy, data),
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
	dealt.game.cleanUp();
	return { ...createHarness(saved, options.maxConcurrent), botId, secondBotId };
}
function reverseLayout(request: BotDecisionRequest): HanabiHandLayout {
	return {
		orderedRow: request.observation.players
			.find(({ id }) => id === request.observation.playerId)!
			.hand.map(({ tileId }) => tileId)
			.reverse(),
		lowerArea: [],
	};
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
function firstAction(harness: ReturnType<typeof seeded>, type: 'play' | 'discard', valid = true) {
	const { data } = snapshot(harness.game);
	const tileId = data.playerTiles[harness.botId].find(
		(id) => type === 'discard' || (data.tiles[id].number === 1) === valid,
	);
	expect(tileId, 'The real dealt fixture must contain the requested card rank').toBeDefined();
	harness.chooseAction.mockImplementationOnce((request) =>
		Promise.resolve({
			...decision(request),
			actionId: request.legalActions.find(
				({ action }) => action.type === type && action.tileId === tileId,
			)!.id,
		}),
	);
	return tileId!;
}
async function finishedResult(harness: Harness & { botId: string }) {
	await vi.waitFor(() =>
		expect(snapshot(harness.game).botRound?.notepads?.[harness.botId].entries).toHaveLength(2),
	);
	await settle();
}

describe('bot result reflections', () => {
	it.each(['successful play', 'failed play', 'discard'] as const)(
		'reflects on its own %s without taking another turn',
		async (scenario) => {
			const harness = seeded();
			const type = scenario === 'discard' ? 'discard' : 'play';
			const tileId = firstAction(harness, type, scenario !== 'failed play');
			const before = snapshot(harness.game);
			harness.game.startBackgroundWork();
			await finishedResult(harness);
			const after = snapshot(harness.game);
			const request = harness.chooseAction.mock.calls[1][0];
			const history = after.botRound!.history;
			if (history.version !== 2) throw new Error('Expected event history.');
			expect(request).toMatchObject({
				opportunity: 'result',
				legalActions: [],
				sourceClueEventIds: [],
				sourceActionEventId: history.events[0].eventId,
			});
			if (request.observation.version !== 2) throw new Error('Expected enriched observation.');
			const revealed = request.observation.history.events[0];
			expect(revealed).toMatchObject({
				type,
				tile: {
					tileId,
					color: before.data.tiles[tileId].color,
					number: before.data.tiles[tileId].number,
				},
				drawnTiles: [expect.objectContaining({ face: null })],
			});
			expect(
				request.observation.players
					.find(({ id }) => id === harness.botId)!
					.hand.every(({ face }) => face === null),
			).toBe(true);
			expect(request.notepad?.entries).toHaveLength(1);
			expect(history.events).toHaveLength(1);
			expect(history.events[0]).toMatchObject({
				type,
				actorId: harness.botId,
				tile: { id: tileId },
			});
			if (type === 'play')
				expect(history.events[0]).toMatchObject({ valid: scenario === 'successful play' });
			expect(after.data.lives).toBe(before.data.lives - (scenario === 'failed play' ? 1 : 0));
			expect(after.botRound?.pendingResults ?? []).toEqual([]);
			expect(after.data.currentPlayerId).toBe('host');
			expect(after.transcript?.moves).toHaveLength(1);
			expect(harness.chooseAction).toHaveBeenCalledTimes(2);
			expect(after.botRound?.notepads?.[harness.botId].entries[1]).toMatchObject({
				opportunity: 'result',
				sourceActionEventId: history.events[0].eventId,
				observedAt: { turnIndex: 1 },
				recordedAt: { turnIndex: 1 },
			});
		},
	);

	it('lets a human play while the same reflection finishes and rearranges the bot hand', async () => {
		const harness = seeded();
		firstAction(harness, 'discard');
		const pending = deferred();
		harness.chooseAction.mockReturnValue(pending.promise);
		harness.game.startBackgroundWork();
		await vi.waitFor(() => expect(harness.chooseAction).toHaveBeenCalledTimes(2));
		const request = harness.chooseAction.mock.calls[1][0];
		const tileId = snapshot(harness.game).data.playerTiles.host[0];
		send(harness, 'DiscardTileMessage', { id: tileId });
		expect(snapshot(harness.game).transcript?.moves).toHaveLength(2);
		expect(snapshot(harness.game).data.currentPlayerId).toBe(harness.botId);
		expect(request.signal.aborted).toBe(false);
		expect(
			harness.sockets.send.mock.calls
				.filter(([, message]) => message.type === 'RefreshGameDataMessage')
				.at(-1)?.[1],
		).toMatchObject({ data: { bots: { turn: null } } });
		await settle();
		expect(harness.chooseAction).toHaveBeenCalledTimes(2);
		const layout = reverseLayout(request);
		// Keep the bot's next turn pending so the completed result can be inspected.
		harness.chooseAction.mockReturnValue(new Promise(() => {}));
		pending.resolve(decision(request, layout));
		await finishedResult(harness);
		const after = snapshot(harness.game);
		expect(
			getHanabiHandLayout(after.data.playerTiles[harness.botId], after.data.tilePositions),
		).toEqual(layout);
		expect(after.botRound?.notepads?.[harness.botId].entries[1]).toMatchObject({
			observedAt: { turnIndex: 1 },
			recordedAt: { turnIndex: 2 },
		});
		expect(harness.chooseAction).toHaveBeenCalledTimes(3);
		expect(() => createHarness(after)).not.toThrow();
	});

	it('lets the next bot act and queue its own reflection while the first is pending', async () => {
		const harness = seeded({ secondBot: true });
		firstAction(harness, 'discard');
		const pending = deferred();
		harness.chooseAction.mockImplementation((request) => {
			if (request.opportunity === 'result' && request.observation.playerId === harness.botId)
				return pending.promise;
			return Promise.resolve({
				...decision(request),
				actionId:
					request.opportunity === 'turn'
						? request.legalActions.find(({ action }) => action.type === 'discard')!.id
						: null,
			});
		});
		harness.game.startBackgroundWork();
		await vi.waitFor(() => expect(snapshot(harness.game).data.currentPlayerId).toBe('host'));
		const request = harness.chooseAction.mock.calls.find(([r]) => r.opportunity === 'result')![0];
		expect(request.signal.aborted).toBe(false);
		const during = snapshot(harness.game);
		expect(during.transcript?.moves).toHaveLength(2);
		expect(during.botRound?.pendingResults).toHaveLength(2);
		expect(() => createHarness(during)).not.toThrow();
		pending.resolve(decision(request, reverseLayout(request)));
		await vi.waitFor(() => expect(snapshot(harness.game).botRound?.pendingResults).toEqual([]));
		const after = snapshot(harness.game);
		expect(after.botRound?.notepads?.[harness.botId].entries).toHaveLength(2);
		expect(after.botRound?.notepads?.[harness.secondBotId].entries).toHaveLength(2);
		expect(after.transcript?.handMovements).toHaveLength(1);
		expect(() => createHarness(after)).not.toThrow();
	});

	it('automatically resumes the next bot when reflection releases the only request slot', async () => {
		const harness = seeded({ secondBot: true, maxConcurrent: 1 });
		firstAction(harness, 'discard');
		const pending = deferred();
		harness.chooseAction.mockImplementation((request) => {
			if (request.opportunity === 'result') return pending.promise;
			return Promise.resolve({
				...decision(request),
				actionId: request.legalActions.find(
					({ action }) => action.type === 'clue' && action.to === 'host',
				)!.id,
			});
		});
		harness.game.startBackgroundWork();
		await vi.waitFor(() => expect(snapshot(harness.game).botRound?.failure).toBe('busy'));
		const request = harness.chooseAction.mock.calls[1][0];
		pending.resolve(decision(request));
		await vi.waitFor(() => expect(snapshot(harness.game).data.currentPlayerId).toBe('host'));
		expect(snapshot(harness.game).transcript?.moves).toHaveLength(2);
		expect(snapshot(harness.game).botRound?.failure).toBeUndefined();
		expect(harness.chooseAction).toHaveBeenCalledTimes(3);
	});

	it('accepts private reservation notes with dragging disabled', async () => {
		const harness = seeded({ dragging: false });
		firstAction(harness, 'discard');
		harness.chooseAction.mockImplementation((request) =>
			Promise.resolve({
				...decision(request),
				notes: 'Reserve the oldest remaining card conceptually.',
			}),
		);
		harness.game.startBackgroundWork();
		await finishedResult(harness);
		const after = snapshot(harness.game);
		expect(harness.chooseAction.mock.calls[1][0].policy.rules?.allowDragging).toBe(false);
		expect(after.botRound?.notepads?.[harness.botId].entries[1].notes).toBe(
			'Reserve the oldest remaining card conceptually.',
		);
		expect(after.transcript?.handMovements).toEqual([]);
	});

	it('rearranges the post-draw hand using only its current cards', async () => {
		const harness = seeded();
		const removedId = firstAction(harness, 'discard');
		harness.chooseAction.mockImplementation((request) =>
			Promise.resolve(decision(request, reverseLayout(request))),
		);
		harness.game.startBackgroundWork();
		await finishedResult(harness);
		const after = snapshot(harness.game);
		const layout = reverseLayout(harness.chooseAction.mock.calls[1][0]);
		expect(layout.orderedRow).not.toContain(removedId);
		expect(
			getHanabiHandLayout(after.data.playerTiles[harness.botId], after.data.tilePositions),
		).toEqual(layout);
		expect(after.transcript?.moves).toHaveLength(1);
		expect(after.transcript?.handMovements).toHaveLength(1);
	});

	it('rejects a result layout containing the removed card without applying notes or movement', async () => {
		const harness = seeded();
		const oldHand = snapshot(harness.game).data.playerTiles[harness.botId];
		firstAction(harness, 'discard');
		harness.chooseAction.mockImplementation((request) =>
			Promise.resolve(decision(request, { orderedRow: oldHand, lowerArea: [] })),
		);
		harness.game.startBackgroundWork();
		await vi.waitFor(() => expect(harness.chooseAction).toHaveBeenCalledTimes(2));
		await vi.waitFor(() =>
			expect(snapshot(harness.game).botRound?.pendingResults ?? []).toEqual([]),
		);
		const after = snapshot(harness.game);
		expect(after.botRound?.notepads?.[harness.botId].entries).toHaveLength(1);
		expect(after.transcript?.handMovements).toEqual([]);
	});

	it('records the final-turn outcome after the round ends without another move', async () => {
		const harness = seeded({ finalTurn: true });
		firstAction(harness, 'discard');
		harness.game.startBackgroundWork();
		await finishedResult(harness);
		const after = snapshot(harness.game);
		expect(after.data.stage).toBe(HanabiStage.Finished);
		expect(harness.chooseAction.mock.calls[1][0].observation.stage).toBe(HanabiStage.Finished);
		expect(after.transcript?.moves).toHaveLength(1);
		expect(after.transcript?.handMovements).toEqual([]);
		expect(() => createHarness(after)).not.toThrow();
	});

	it.each([false, true])(
		'resumes a persisted pending reflection once (legacy: %s)',
		async (legacy) => {
			const harness = seeded();
			firstAction(harness, 'discard');
			const pending = deferred();
			harness.chooseAction.mockReturnValue(pending.promise);
			harness.game.startBackgroundWork();
			await vi.waitFor(() => expect(harness.chooseAction).toHaveBeenCalledTimes(2));
			const saved = snapshot(harness.game);
			expect(saved.botRound?.pendingResults?.[0]?.playerId).toBe(harness.botId);
			if (legacy) {
				saved.botRound!.pendingResult = saved.botRound!.pendingResults![0];
				delete saved.botRound!.pendingResults;
			}
			harness.game.cleanUp();
			const resumed = { ...createHarness(saved), botId: harness.botId };
			resumed.game.startBackgroundWork();
			await finishedResult(resumed);
			expect(resumed.chooseAction).toHaveBeenCalledOnce();
			expect(resumed.chooseAction.mock.calls[0][0].opportunity).toBe('result');
			const completed = createHarness(snapshot(resumed.game));
			completed.game.startBackgroundWork();
			await settle();
			expect(completed.chooseAction).not.toHaveBeenCalled();
			expect(snapshot(completed.game).botRound?.notepads).toEqual(
				snapshot(resumed.game).botRound?.notepads,
			);
		},
	);

	it('resumes background work after stopping without accepting the cancelled result', async () => {
		const harness = seeded();
		firstAction(harness, 'discard');
		const pending = deferred();
		harness.chooseAction.mockReturnValue(pending.promise);
		harness.game.startBackgroundWork();
		await vi.waitFor(() => expect(harness.chooseAction).toHaveBeenCalledTimes(2));
		const request = harness.chooseAction.mock.calls[1][0];
		harness.game.stopBackgroundWork();
		expect(request.signal.aborted).toBe(true);
		harness.chooseAction.mockImplementation((r) => Promise.resolve(decision(r)));
		harness.game.startBackgroundWork();
		pending.resolve({ ...decision(request), notes: 'Cancelled review' });
		await finishedResult(harness);
		const after = snapshot(harness.game);
		expect(harness.chooseAction).toHaveBeenCalledTimes(3);
		expect(after.botRound?.notepads?.[harness.botId].entries[1].notes).toBeNull();
		expect(after.botRound?.attempts).toBe(3);
		expect(after.botRound?.tokens).toBeGreaterThanOrEqual(45);
		expect(() => createHarness(after)).not.toThrow();
	});

	it('keeps review notes without moving tiles if another player ends the game', async () => {
		const initial = seeded();
		const saved = snapshot(initial.game);
		saved.data.discardedTiles = [...saved.data.discardedTiles, ...saved.data.remainingTiles];
		saved.data.remainingTiles = [];
		saved.data.remainingTurns = 2;
		saved.botRound!.history = createBotHistory(saved.data, 2);
		saved.transcript = createGameTranscript(
			{ gameId: saved.id, gameCode: saved.code },
			saved.data,
			saved.updated,
		);
		initial.game.cleanUp();
		const harness = {
			...createHarness(saved),
			botId: initial.botId,
			secondBotId: initial.secondBotId,
		};
		firstAction(harness, 'discard');
		const pending = deferred();
		harness.chooseAction.mockReturnValue(pending.promise);
		harness.game.startBackgroundWork();
		await vi.waitFor(() => expect(harness.chooseAction).toHaveBeenCalledTimes(2));
		const request = harness.chooseAction.mock.calls[1][0];
		send(harness, 'DiscardTileMessage', { id: snapshot(harness.game).data.playerTiles.host[0] });
		expect(snapshot(harness.game).data.stage).toBe(HanabiStage.Finished);
		pending.resolve({
			...decision(request, reverseLayout(request)),
			notes: 'Remember the revealed card.',
		});
		await finishedResult(harness);
		const after = snapshot(harness.game);
		expect(after.transcript?.handMovements).toEqual([]);
		expect(after.botRound?.notepads?.[harness.botId].entries[1].notes).toBe(
			'Remember the revealed card.',
		);
		expect(() => createHarness(after)).not.toThrow();
	});

	it('ignores a late reflection after reset', async () => {
		const harness = seeded();
		firstAction(harness, 'discard');
		const pending = deferred();
		harness.chooseAction.mockReturnValue(pending.promise);
		harness.game.startBackgroundWork();
		await vi.waitFor(() => expect(harness.chooseAction).toHaveBeenCalledTimes(2));
		const request = harness.chooseAction.mock.calls[1][0];
		send(harness, 'ResetGameMessage', undefined);
		const reset = snapshot(harness.game);
		pending.resolve({
			...decision(request, reverseLayout(request)),
			notes: 'Stale result must not be saved.',
		});
		await settle();
		expect(request.signal.aborted).toBe(true);
		expect(snapshot(harness.game).data).toEqual(reset.data);
		expect(snapshot(harness.game).botRound).toEqual(reset.botRound);
		expect(snapshot(harness.game).transcript).toEqual(reset.transcript);
	});

	it('skips a failed reflection and lets the next bot act without retrying it', async () => {
		const harness = seeded({ secondBot: true });
		firstAction(harness, 'discard');
		harness.chooseAction.mockImplementation((request) => {
			if (request.opportunity === 'result')
				return Promise.reject(new Error('Reflection unavailable'));
			return Promise.resolve({
				...decision(request),
				actionId: request.legalActions.find(
					({ action }) => action.type === 'clue' && action.to === 'host',
				)!.id,
			});
		});
		harness.game.startBackgroundWork();
		await vi.waitFor(() => expect(snapshot(harness.game).data.currentPlayerId).toBe('host'));
		await settle();
		expect(
			harness.chooseAction.mock.calls.map(([request]) => [
				request.observation.playerId,
				request.opportunity,
			]),
		).toEqual([
			[harness.botId, 'turn'],
			[harness.botId, 'result'],
			[harness.secondBotId, 'turn'],
		]);
		expect(snapshot(harness.game).botRound?.pendingResults ?? []).toEqual([]);
		expect(snapshot(harness.game).transcript?.moves).toHaveLength(2);
	});
});
