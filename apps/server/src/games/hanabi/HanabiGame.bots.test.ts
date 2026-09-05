import {
	HANABI_MAX_ACTIONS,
	HANABI_MAX_PLAYERS,
	HanabiGameActionType,
	HanabiFinishedReason,
	HanabiStage,
	PubSub,
	getScope,
	type HanabiMessage,
} from '@hanabi/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type ServerSocketManager from '../../utils/SocketManager.js';
import type { SaveGameDelegate } from '../server/GameStore.js';
import { createGameTranscript, type GameTranscriptSnapshot } from './GameTranscript.js';
import type HanabiGame from './HanabiGame.js';
import type { HanabiGameSerialized } from './HanabiGame.js';
import HanabiGameFactory from './HanabiGameFactory.js';
import { createBotPolicy, createRoundBotPolicy, type BotPolicy } from './bots/BotPolicy.js';
import { BotRuntime, type BotLimits } from './bots/BotRuntime.js';
import { createBotHistory } from './bots/BotHistory.js';
import type { BotDecision, BotDecisionProvider } from './bots/OpenAiBot.js';
import { BOT_NAMES } from './bots/BotNames.js';

// Repeatedly choosing the first available name makes collision tests deterministic.
vi.mock('node:crypto', async (importOriginal) => ({
	...(await importOriginal<typeof import('node:crypto')>()),
	randomInt: vi.fn(() => 0),
}));

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

afterEach(async () => {
	for (const game of games.splice(0)) {
		game.cleanUp();
		game.stopSaving();
		await game.flushSaves();
	}
});

function snapshot(game: HanabiGame): HanabiGameSerialized {
	return JSON.parse(game.serialize()!) as HanabiGameSerialized;
}

function deferredDecision() {
	let resolve!: (decision: BotDecision) => void;
	const promise = new Promise<BotDecision>((complete) => {
		resolve = (decision) =>
			complete({ arrangement: null, explanation: 'Test decision.', notes: null, ...decision });
	});
	return { promise, resolve };
}

function createHarness(
	options: {
		serialized?: HanabiGameSerialized;
		disabled?: boolean;
		policy?: BotPolicy;
		limits?: Partial<BotLimits>;
	} = {},
) {
	const sockets = new FakeSocketManager();
	const saved: HanabiGameSerialized[] = [];
	const saveGame = vi.fn<SaveGameDelegate['saveGame']>().mockImplementation((game) => {
		saved.push(JSON.parse(game.serialize()!) as HanabiGameSerialized);
		return Promise.resolve();
	});
	const saveDelegate: SaveGameDelegate = {
		saveGame,
		deleteGame: vi.fn().mockResolvedValue(undefined),
	};
	const chooseAction = vi
		.fn<BotDecisionProvider['chooseAction']>()
		.mockImplementation((request) => {
			const action = request.legalActions.find(({ action }) => action.type === 'clue');
			if (!action) return Promise.reject(new Error('Test needs a legal clue.'));
			return Promise.resolve({
				actionId: action.id,
				arrangement: null,
				explanation: 'Give a helpful clue.',
				notes: null,
				inputTokens: 10,
				outputTokens: 3,
			});
		});
	const runtime = options.disabled
		? undefined
		: new BotRuntime(
				{ chooseAction },
				options.policy ?? createBotPolicy('test-model', 'Test coaching'),
				options.limits,
			);
	const recorded: GameTranscriptSnapshot[] = [];
	const factory = new HanabiGameFactory(
		2,
		false,
		{
			record: (transcript) => {
				recorded.push(transcript);
			},
			close: () => Promise.resolve(),
		},
		runtime,
	);
	const socketManager = sockets as unknown as ServerSocketManager;
	const game = options.serialized
		? factory.hydrate(JSON.stringify(options.serialized), socketManager, saveDelegate)
		: factory.create('host', socketManager, saveDelegate);
	games.push(game);
	return { game, sockets, chooseAction, runtime, recorded, saved, saveGame, factory, saveDelegate };
}

type Harness = ReturnType<typeof createHarness>;
type MessagePayloads = { [Message in HanabiMessage as Message['type']]: Message['data'] };

function send<Type extends HanabiMessage['type']>(
	harness: Harness,
	userId: string,
	type: Type,
	data: MessagePayloads[Type],
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
): MessagePayloads[Type] {
	const sent = [...harness.sockets.sent]
		.reverse()
		.find((item) => item.recipients === userId && item.message.type === type);
	if (!sent) throw new Error(`Missing ${type} for ${userId}.`);
	return sent.message.data as MessagePayloads[Type];
}

function refresh(harness: Harness) {
	send(harness, 'host', 'GetGameDataMessage', undefined);
	return response(harness, 'RefreshGameDataMessage');
}

function joinHostAndBot(harness: Harness): string {
	send(harness, 'host', 'AddPlayerMessage', { name: 'Host' });
	send(harness, 'host', 'AddBotMessage', undefined);
	const botId = response(harness, 'AddBotResponseMessage').playerId;
	if (!botId) throw new Error('Expected a bot seat.');
	return botId;
}

/** Reach a bot turn through ordinary gameplay regardless of the randomized first seat. */
function startOnBot(harness: Harness): string {
	const botId = joinHostAndBot(harness);
	send(harness, 'host', 'StartGameMessage', undefined);
	const state = snapshot(harness.game).data;
	if (state.currentPlayerId === 'host') {
		send(harness, 'host', 'GiveClueMessage', {
			to: botId,
			number: state.tiles[state.playerTiles[botId][0]].number,
		});
	}
	expect(snapshot(harness.game).data.currentPlayerId).toBe(botId);
	return botId;
}

async function settle() {
	await new Promise((resolve) => setTimeout(resolve, 10));
}

describe('server bot game integration', () => {
	it('gives new bots distinct robot names without colliding with a human name', () => {
		const harness = createHarness();
		send(harness, 'host', 'AddPlayerMessage', { name: '  wall-e  ' });
		for (let index = 1; index < HANABI_MAX_PLAYERS; index += 1) {
			send(harness, 'host', 'AddBotMessage', undefined);
			expect(response(harness, 'AddBotResponseMessage').error).toBeUndefined();
		}
		const bots = Object.values(snapshot(harness.game).data.players).filter(
			(player) => player.kind === 'bot',
		);
		expect(bots).toHaveLength(HANABI_MAX_PLAYERS - 1);
		const names = bots.map((bot) => bot.name);
		expect(new Set(names).size).toBe(names.length);
		for (const name of names) {
			expect(BOT_NAMES).toContain(name);
			expect(name.toLowerCase()).not.toBe('wall-e');
		}
	});

	it('preserves saved bot names when restoring a lobby and adding another bot', () => {
		const harness = createHarness();
		const botId = joinHostAndBot(harness);
		const saved = snapshot(harness.game);
		const restored = createHarness({ serialized: saved });
		expect(snapshot(restored.game).data.players[botId].name).toBe(saved.data.players[botId].name);

		const legacySaved = snapshot(harness.game);
		legacySaved.data.players[botId].name = 'Bot 1';
		const legacy = createHarness({ serialized: legacySaved });
		send(legacy, 'host', 'AddBotMessage', undefined);
		const newBotId = response(legacy, 'AddBotResponseMessage').playerId!;
		const players = snapshot(legacy.game).data.players;
		expect(players[botId].name).toBe('Bot 1');
		expect(BOT_NAMES).toContain(players[newBotId].name);
	});

	it('limits bot management to the joined host, uses distinct identities, and enforces capacity', () => {
		const harness = createHarness();
		send(harness, 'host', 'AddBotMessage', undefined);
		expect(response(harness, 'AddBotResponseMessage').error).toMatch(/joined host/);
		send(harness, 'guest', 'AddPlayerMessage', { name: 'Guest' });
		for (const userId of ['guest', 'spectator']) {
			send(harness, userId, 'AddBotMessage', undefined);
			expect(response(harness, 'AddBotResponseMessage', userId).error).toMatch(/joined host/);
		}
		const botId = joinHostAndBot(harness);
		send(harness, 'host', 'AddBotMessage', undefined);
		const secondId = response(harness, 'AddBotResponseMessage').playerId;
		expect(secondId).not.toBe(botId);
		expect(snapshot(harness.game).data.players[botId]).toMatchObject({
			kind: 'bot',
			connected: true,
		});
		send(harness, 'guest', 'RemovePlayerMessage', { playerId: botId });
		expect(response(harness, 'RemovePlayerResponseMessage', 'guest').error).toMatch(/host/);
		send(harness, 'host', 'RemovePlayerMessage', { playerId: botId });
		expect(snapshot(harness.game).data.players).not.toHaveProperty(botId);
		while (Object.keys(snapshot(harness.game).data.players).length < HANABI_MAX_PLAYERS) {
			send(harness, 'host', 'AddBotMessage', undefined);
		}
		send(harness, 'host', 'AddBotMessage', undefined);
		expect(response(harness, 'AddBotResponseMessage').error).toMatch(/at most 5/);
		expect(Object.keys(snapshot(harness.game).data.players)).toHaveLength(HANABI_MAX_PLAYERS);
	});

	it('blocks mid-game management and forged bot socket actions', () => {
		const harness = createHarness();
		const botId = startOnBot(harness);
		const before = snapshot(harness.game);
		const tileId = before.data.playerTiles[botId][0];
		send(harness, 'host', 'AddBotMessage', undefined);
		expect(response(harness, 'AddBotResponseMessage').error).toMatch(/started/);
		send(harness, 'host', 'RemovePlayerMessage', { playerId: botId });
		expect(response(harness, 'RemovePlayerResponseMessage').error).toMatch(/started/);
		send(harness, botId, 'PlayTileMessage', { id: tileId });
		send(harness, botId, 'AddPlayerMessage', { name: 'Forged human' });
		send(harness, 'host', 'PlayTileMessage', { id: tileId });
		send(harness, 'host', 'DebugPlayerActionMessage', { action: { type: 'play', tileId } });
		send(harness, 'spectator', 'GiveClueMessage', { to: 'host', number: 1 });
		expect(snapshot(harness.game).data).toEqual(before.data);
		expect(snapshot(harness.game).botRound).toEqual(before.botRound);
		expect(snapshot(harness.game).transcript?.moves).toEqual(before.transcript?.moves);
		expect(harness.chooseAction).not.toHaveBeenCalled();
	});

	it('cannot start a bot-only lobby after every human has left', () => {
		const harness = createHarness();
		const botId = joinHostAndBot(harness);
		send(harness, 'host', 'AddBotMessage', undefined);
		send(harness, 'host', 'RemovePlayerMessage', {});
		send(harness, 'host', 'StartGameMessage', undefined);
		expect(response(harness, 'StartGameResponseMessage').error).toMatch(/Only players/);
		send(harness, botId, 'StartGameMessage', undefined);
		expect(snapshot(harness.game).data.stage).toBe(HanabiStage.Setup);
		expect(harness.chooseAction).not.toHaveBeenCalled();
	});

	it('persists a reservation before inference and records one normal bot move, public history, and transcript', async () => {
		const harness = createHarness();
		const botId = startOnBot(harness);
		const before = snapshot(harness.game);
		harness.chooseAction.mockImplementation((request) => {
			expect(harness.saved.at(-1)?.botRound).toMatchObject({ attempts: 1, status: 'thinking' });
			const clue = request.legalActions.find(({ action }) => action.type === 'clue')!;
			return Promise.resolve({
				actionId: clue.id,
				arrangement: null,
				explanation: 'Give a helpful clue.',
				notes: null,
				inputTokens: 10,
				outputTokens: 3,
			});
		});
		harness.game.startBackgroundWork();
		await vi.waitFor(() => expect(snapshot(harness.game).data.currentPlayerId).toBe('host'));
		await harness.game.flushSaves();
		const after = snapshot(harness.game);
		expect(harness.chooseAction).toHaveBeenCalledTimes(1);
		expect(after.botRound).toMatchObject({ attempts: 1, tokens: 13 });
		expect(after.botRound?.history.moves).toHaveLength(
			(before.botRound?.history.moves.length ?? 0) + 1,
		);
		expect(after.transcript?.moves).toHaveLength((before.transcript?.moves.length ?? 0) + 1);
		expect(after.transcript?.moves.at(-1)).toMatchObject({ type: 'clue', actorId: botId });
		expect(after.botRound?.history.moves.at(-1)?.actionId).toBe(
			after.transcript?.moves.at(-1)?.actionId,
		);
		expect(harness.recorded.at(-1)?.moves.at(-1)?.actorId).toBe(botId);
		expect(after.data.clues).toBe(before.data.clues - 1);
		const publicState = refresh(harness);
		expect(publicState).not.toHaveProperty('botRound');
		expect(JSON.stringify(publicState)).not.toContain(after.botRound!.policy.hash);
		expect(JSON.stringify(publicState)).not.toContain('Test coaching');
	});

	it('keeps complete clue history after chat evicts ordinary activity entries', async () => {
		const harness = createHarness();
		const botId = startOnBot(harness);
		harness.game.startBackgroundWork();
		await vi.waitFor(() => expect(snapshot(harness.game).data.currentPlayerId).toBe('host'));
		harness.game.stopBackgroundWork();
		const state = snapshot(harness.game).data;
		const number = state.tiles[state.playerTiles[botId][0]].number;
		send(harness, 'host', 'GiveClueMessage', { to: botId, number });
		const history = snapshot(harness.game).botRound!.history;
		const clue = history.moves.at(-1)!;
		for (let index = 0; index <= HANABI_MAX_ACTIONS; index += 1) {
			send(harness, 'host', 'SendChatMessage', `Public chat ${index}`);
		}
		const after = snapshot(harness.game);
		expect(after.data.actions.every((action) => action.type === HanabiGameActionType.Chat)).toBe(
			true,
		);
		expect(after.botRound?.history).toEqual(history);
		harness.game.startBackgroundWork();
		await vi.waitFor(() => expect(harness.chooseAction).toHaveBeenCalledTimes(2));
		const observation = harness.chooseAction.mock.calls[1][0].observation;
		expect(observation.history.complete).toBe(true);
		expect(observation.version).toBe(2);
		if (observation.version !== 2) throw new Error('Expected v2 observation.');
		expect(observation.history.events.at(-1)).toMatchObject({
			actionId: clue.actionId,
			type: 'clue',
			actorId: 'host',
		});
		const touched = observation.players
			.find((player) => player.id === botId)!
			.hand.filter((card) => card.clueKnowledge.matchingNumbers.includes(number));
		expect(touched.length).toBeGreaterThan(0);
	});

	it('continues an in-flight bot turn after the human disconnects and preserves bot availability on reconnect', async () => {
		const harness = createHarness();
		const pending = deferredDecision();
		harness.chooseAction.mockReturnValue(pending.promise);
		const botId = startOnBot(harness);
		harness.game.startBackgroundWork();
		await vi.waitFor(() => expect(harness.chooseAction).toHaveBeenCalledTimes(1));
		const request = harness.chooseAction.mock.calls[0][0];
		harness.sockets.onDisconnect.emit({ userId: 'host' });
		harness.sockets.onDisconnect.emit({ userId: botId });
		expect(snapshot(harness.game).data.players).toMatchObject({
			host: { connected: false },
			[botId]: { connected: true },
		});
		expect(request.signal.aborted).toBe(false);
		pending.resolve({
			actionId: request.legalActions.find(({ action }) => action.type === 'clue')!.id,
		});
		await vi.waitFor(() => expect(snapshot(harness.game).data.currentPlayerId).toBe('host'));
		harness.sockets.onAuthenticate.emit({ userId: 'host' });
		expect(refresh(harness).players[botId]).toMatchObject({ kind: 'bot', connected: true });
	});

	it('hydrates an interrupted turn without inference until background work starts and retains prior quota', async () => {
		const original = createHarness();
		const botId = startOnBot(original);
		const saved = snapshot(original.game);
		Object.assign(saved.botRound!, { attempts: 2, tokens: 999, status: 'thinking' });
		original.game.cleanUp();
		const restored = createHarness({ serialized: saved });
		await settle();
		expect(restored.chooseAction).not.toHaveBeenCalled();
		expect(snapshot(restored.game).data.players[botId].connected).toBe(true);
		expect(snapshot(restored.game).data.players.host.connected).toBe(false);
		restored.game.startBackgroundWork();
		await vi.waitFor(() => expect(snapshot(restored.game).data.currentPlayerId).toBe('host'));
		expect(restored.chooseAction).toHaveBeenCalledTimes(1);
		expect(snapshot(restored.game).botRound).toMatchObject({ attempts: 3, tokens: 1012 });
	});

	it('preserves a failed round policy across deployment and accepts a seated-human retry', async () => {
		const original = createHarness();
		startOnBot(original);
		const saved = snapshot(original.game);
		Object.assign(saved.botRound!, {
			attempts: 7,
			tokens: 321,
			status: 'error',
			failure: 'refused',
			lastAttemptAt: Date.now() - 3_000,
		});
		original.game.cleanUp();
		const newPolicy = createBotPolicy('new-model', 'New deployment coaching', 'high');
		const restored = createHarness({ serialized: saved, policy: newPolicy });
		restored.game.startBackgroundWork();
		await settle();
		expect(restored.chooseAction).not.toHaveBeenCalled();
		expect(refresh(restored).bots?.turn).toMatchObject({ status: 'error', canRetry: true });
		send(restored, 'spectator', 'RetryBotTurnMessage', undefined);
		expect(response(restored, 'RetryBotTurnResponseMessage', 'spectator').error).toMatch(/players/);
		send(restored, 'host', 'RetryBotTurnMessage', undefined);
		await vi.waitFor(() => expect(restored.chooseAction).toHaveBeenCalledTimes(1));
		expect(restored.chooseAction.mock.calls[0][0].policy).toEqual(saved.botRound!.policy);
		await vi.waitFor(() => expect(snapshot(restored.game).data.currentPlayerId).toBe('host'));
		expect(snapshot(restored.game).botRound).toMatchObject({ attempts: 8, tokens: 334 });
		restored.game.stopBackgroundWork();
		send(restored, 'host', 'ResetGameMessage', undefined);
		send(restored, 'host', 'StartGameMessage', undefined);
		expect(snapshot(restored.game).botRound?.policy).toEqual(
			createRoundBotPolicy(newPolicy, snapshot(restored.game).data),
		);
	});

	it('restores exhausted quota without making another request or advertising an ineffective retry', async () => {
		const original = createHarness();
		startOnBot(original);
		const saved = snapshot(original.game);
		Object.assign(saved.botRound!, {
			attempts: 200,
			tokens: 100,
			status: 'exhausted',
			failure: 'round_budget',
		});
		original.game.cleanUp();
		const restored = createHarness({ serialized: saved });
		restored.game.startBackgroundWork();
		await settle();
		expect(refresh(restored).bots?.turn).toMatchObject({ status: 'exhausted', canRetry: false });
		send(restored, 'host', 'RetryBotTurnMessage', undefined);
		expect(response(restored, 'RetryBotTurnResponseMessage').error).toBeTruthy();
		expect(restored.chooseAction).not.toHaveBeenCalled();
		expect(snapshot(restored.game).botRound?.attempts).toBe(200);
	});

	it('rejects a corrupted saved policy and a started bot game with no private round state', () => {
		const original = createHarness();
		startOnBot(original);
		const saved = snapshot(original.game);
		const corrupted = structuredClone(saved);
		corrupted.botRound!.policy = { ...corrupted.botRound!.policy, instructions: 'replacement' };
		expect(() => createHarness({ serialized: corrupted })).toThrow(/botRound/);
		delete saved.botRound;
		expect(() => createHarness({ serialized: saved })).toThrow(/preserve their bot round/);
	});

	it('aborts a reset turn, keeps bot seats, and rejects its late response in the next round', async () => {
		const harness = createHarness();
		const pending = deferredDecision();
		harness.chooseAction.mockReturnValue(pending.promise);
		const botId = startOnBot(harness);
		harness.game.startBackgroundWork();
		await vi.waitFor(() => expect(harness.chooseAction).toHaveBeenCalledTimes(1));
		const request = harness.chooseAction.mock.calls[0][0];
		const oldRoundId = snapshot(harness.game).botRound!.roundId;
		send(harness, 'host', 'ResetGameMessage', undefined);
		expect(request.signal.aborted).toBe(true);
		expect(snapshot(harness.game).data.players[botId].kind).toBe('bot');
		expect(snapshot(harness.game).data.stage).toBe(HanabiStage.Setup);
		harness.game.stopBackgroundWork();
		send(harness, 'host', 'StartGameMessage', undefined);
		const next = snapshot(harness.game);
		expect(next.botRound?.roundId).not.toBe(oldRoundId);
		pending.resolve({ actionId: request.legalActions[0].id });
		await settle();
		expect(snapshot(harness.game).botRound).toEqual(next.botRound);
		expect(snapshot(harness.game).transcript?.moves).toHaveLength(0);
		expect(harness.chooseAction).toHaveBeenCalledTimes(1);
	});

	it('stops inference before flushing saves and does not mutate after shutdown', async () => {
		const harness = createHarness();
		const pending = deferredDecision();
		harness.chooseAction.mockReturnValue(pending.promise);
		startOnBot(harness);
		harness.game.startBackgroundWork();
		await vi.waitFor(() => expect(harness.chooseAction).toHaveBeenCalledTimes(1));
		const request = harness.chooseAction.mock.calls[0][0];
		harness.game.stopSaving();
		expect(request.signal.aborted).toBe(true);
		await harness.game.flushSaves();
		const stopped = harness.game.serialize();
		const saves = harness.saveGame.mock.calls.length;
		pending.resolve({ actionId: request.legalActions[0].id });
		await settle();
		expect(harness.game.serialize()).toBe(stopped);
		expect(harness.saveGame).toHaveBeenCalledTimes(saves);
	});

	it('ends the game on a critical five discard and prevents subsequent bot inference or moves', async () => {
		const original = createHarness();
		const botId = joinHostAndBot(original);
		send(original, 'host', 'StartGameMessage', undefined);
		const saved = snapshot(original.game);
		original.game.cleanUp();
		const data = saved.data;
		data.currentPlayerId = 'host';
		data.turnOrder = ['host', botId];
		data.clues = 7;
		data.criticalGameOver = true;
		const critical = Object.values(data.tiles).find(
			(tile) => tile.color === 'red' && tile.number === 5,
		)!;
		if (!data.playerTiles.host.includes(critical.id)) {
			const replacedId = data.playerTiles.host[0];
			data.remainingTiles = data.remainingTiles.map((id) => (id === critical.id ? replacedId : id));
			data.playerTiles = {
				...data.playerTiles,
				host: [critical.id, ...data.playerTiles.host.slice(1)],
				[botId]: data.playerTiles[botId].map((id) => (id === critical.id ? replacedId : id)),
			};
			data.tilePositions = {
				...data.tilePositions,
				[critical.id]: { ...data.tilePositions[replacedId] },
			};
		}
		saved.botRound!.history = createBotHistory(data, 2);
		saved.transcript = createGameTranscript(
			{ gameId: saved.id, gameCode: saved.code },
			data,
			saved.updated,
		);
		const harness = createHarness({ serialized: saved });
		harness.game.startBackgroundWork();
		send(harness, 'host', 'DiscardTileMessage', { id: critical.id });
		expect(response(harness, 'DiscardTileResponseMessage').error).toBeUndefined();
		const finished = snapshot(harness.game);
		expect(finished.data).toMatchObject({
			stage: HanabiStage.Finished,
			finishedReason: HanabiFinishedReason.DiscardedFatalTile,
			currentPlayerId: botId,
		});
		expect(finished.transcript?.lifecycle.status).toBe('finished');
		expect(finished.transcript?.moves.at(-1)).toMatchObject({
			type: 'discard',
			actorId: 'host',
			tileId: critical.id,
		});
		send(harness, 'host', 'PlayTileMessage', { id: finished.data.playerTiles.host[0] });
		expect(response(harness, 'PlayTileResponseMessage').error).toMatch(/isn't being played/);
		await settle();
		expect(harness.chooseAction).not.toHaveBeenCalled();
		expect(snapshot(harness.game).data).toEqual(finished.data);
		expect(snapshot(harness.game).transcript?.moves).toEqual(finished.transcript?.moves);
	});

	it('blocks disabled bot starts while allowing the host to remove a bot and play with humans', () => {
		const original = createHarness();
		const botId = joinHostAndBot(original);
		const saved = snapshot(original.game);
		original.game.cleanUp();
		const disabled = createHarness({ serialized: saved, disabled: true });
		send(disabled, 'host', 'AddBotMessage', undefined);
		expect(response(disabled, 'AddBotResponseMessage').error).toMatch(/unavailable/);
		send(disabled, 'host', 'StartGameMessage', undefined);
		expect(response(disabled, 'StartGameResponseMessage').error).toMatch(/unavailable/);
		expect(snapshot(disabled.game).data.stage).toBe(HanabiStage.Setup);
		send(disabled, 'host', 'RemovePlayerMessage', { playerId: botId });
		send(disabled, 'guest', 'AddPlayerMessage', { name: 'Guest' });
		send(disabled, 'guest', 'StartGameMessage', undefined);
		expect(snapshot(disabled.game).data.stage).toBe(HanabiStage.Playing);
	});

	it('shows a disabled state for a restored active bot turn and offers no retry', async () => {
		const original = createHarness();
		const botId = startOnBot(original);
		const saved = snapshot(original.game);
		original.game.cleanUp();
		const disabled = createHarness({ serialized: saved, disabled: true });
		disabled.game.startBackgroundWork();
		await settle();
		expect(refresh(disabled).bots).toMatchObject({
			available: false,
			turn: { playerId: botId, status: 'disabled', canRetry: false },
		});
		send(disabled, 'host', 'RetryBotTurnMessage', undefined);
		expect(response(disabled, 'RetryBotTurnResponseMessage').error).toMatch(/unavailable/);
		expect(disabled.chooseAction).not.toHaveBeenCalled();
		expect(snapshot(disabled.game).botRound).toEqual(saved.botRound);
	});
});
