import {
	generateHanabiGameData,
	HANABI_MAX_ACTIONS,
	HanabiGameActionChat,
	HanabiGameActionType,
	HanabiGameData,
	HanabiFinishedReason,
	HanabiStage,
} from '@hanabi/shared';
import { describe, expect, it, vi } from 'vitest';
import { HanabiGameStore } from './HanabiGameStore';

function game(): HanabiGameData {
	return generateHanabiGameData({
		seed: '',
		stage: HanabiStage.Playing,
		players: {
			alice: { id: 'alice', name: 'Alice', connected: true },
			bot: { id: 'bot', name: 'Ember', connected: false, kind: 'bot' },
		},
		currentPlayerId: 'bot',
		turnOrder: ['alice', 'bot'],
		tiles: { one: { id: 'one', color: 'red', number: 1 } },
		playerTiles: { alice: [], bot: ['one'] },
		tilePositions: { one: { x: 10, y: 10, z: 0 } },
		actions: [{ id: 'start', type: HanabiGameActionType.GameStarted, startingPlayerId: 'bot' }],
		bots: { available: true, canManage: false, turn: null },
	});
}

function decoded(snapshot: HanabiGameData): HanabiGameData {
	return JSON.parse(JSON.stringify(snapshot)) as HanabiGameData;
}

function chat(id = 'debug'): HanabiGameActionChat {
	return { id, type: HanabiGameActionType.Chat, playerId: 'bot', message: 'Debug: Play the one.' };
}

describe('HanabiGameStore subscriptions', () => {
	it('publishes a first snapshot and keeps identical decoded snapshots quiet', () => {
		const store = new HanabiGameStore();
		const listeners = [store.game, store.board, store.activity, store.bots].map((channel) => {
			const listener = vi.fn();
			channel.subscribe(listener);
			return listener;
		});
		expect(store.game.getSnapshot()).toBeNull();
		const initial = game();
		store.receive(decoded(initial));
		const snapshots = [store.game, store.board, store.activity, store.bots].map((channel) =>
			channel.getSnapshot(),
		);
		store.receive(decoded(initial));
		listeners.forEach((listener) => expect(listener).toHaveBeenCalledOnce());
		[store.game, store.board, store.activity, store.bots].forEach((channel, index) =>
			expect(channel.getSnapshot()).toBe(snapshots[index]),
		);
	});

	it('delivers chat only to authoritative and activity subscribers, preserving board branches', () => {
		const initial = game();
		const store = new HanabiGameStore(decoded(initial));
		const before = store.game.getSnapshot()!;
		const board = store.board.getSnapshot();
		const onGame = vi.fn();
		const onActivity = vi.fn();
		const onBoard = vi.fn();
		const onBots = vi.fn();
		store.game.subscribe(onGame);
		store.activity.subscribe(onActivity);
		store.board.subscribe(onBoard);
		store.bots.subscribe(onBots);
		store.receive(decoded({ ...initial, actions: [...initial.actions, chat()] }));

		expect(onGame).toHaveBeenCalledOnce();
		expect(onActivity).toHaveBeenCalledOnce();
		expect(onBoard).not.toHaveBeenCalled();
		expect(onBots).not.toHaveBeenCalled();
		expect(store.activity.getSnapshot()!.actions.at(-1)).toEqual(chat());
		expect(store.board.getSnapshot()).toBe(board);
		expect(store.game.getSnapshot()!.tiles).toBe(before.tiles);
		expect(store.game.getSnapshot()!.playerTiles).toBe(before.playerTiles);
		expect(store.game.getSnapshot()!.players).toBe(before.players);
		expect(store.game.getSnapshot()!.actions[0]).toBe(before.actions[0]);
	});

	it('delivers bot status without notifying board or activity subscribers', () => {
		const initial = game();
		const store = new HanabiGameStore(decoded(initial));
		const onBoard = vi.fn();
		const onActivity = vi.fn();
		const onBots = vi.fn();
		store.board.subscribe(onBoard);
		store.activity.subscribe(onActivity);
		store.bots.subscribe(onBots);
		const bots = {
			...initial.bots!,
			turn: { playerId: 'bot', status: 'thinking' as const, canRetry: false },
		};
		store.receive(decoded({ ...initial, bots }));

		expect(onBots).toHaveBeenCalledOnce();
		expect(onBoard).not.toHaveBeenCalled();
		expect(onActivity).not.toHaveBeenCalled();
		expect(store.bots.getSnapshot()!.bots).toEqual(bots);
		expect(store.board.getSnapshot()).not.toHaveProperty('bots');
	});

	it('makes every channel current before invoking any subscriber', () => {
		const initial = game();
		const store = new HanabiGameStore(decoded(initial));
		const next = decoded({
			...initial,
			clues: 6,
			currentPlayerId: 'alice',
			actions: [...initial.actions, chat()],
			bots: { ...initial.bots!, available: false },
		});
		const observe = vi.fn(() => {
			expect(store.game.getSnapshot()).toEqual(next);
			expect(store.board.getSnapshot()!.clues).toBe(6);
			expect(store.board.getSnapshot()!.currentPlayerId).toBe('alice');
			expect(store.activity.getSnapshot()!.actions.at(-1)).toEqual(chat());
			expect(store.bots.getSnapshot()!.bots!.available).toBe(false);
		});
		[store.game, store.board, store.activity, store.bots].forEach((channel) =>
			channel.subscribe(observe),
		);
		store.receive(next);
		expect(observe).toHaveBeenCalledTimes(4);
	});

	it('retains board events when chat evicts them from the mixed activity log', () => {
		const initial = game();
		const store = new HanabiGameStore(decoded(initial));
		const onBoard = vi.fn();
		store.board.subscribe(onBoard);
		const chats = Array.from({ length: HANABI_MAX_ACTIONS }, (_, index) => chat(`chat-${index}`));
		store.receive(decoded({ ...initial, actions: chats }));

		expect(onBoard).not.toHaveBeenCalled();
		expect(store.board.getSnapshot()!.actions).toEqual(initial.actions);
		expect(store.activity.getSnapshot()!.actions).toEqual(chats);
		expect(store.game.getSnapshot()!.actions).toEqual(chats);
	});

	it('clears board history on setup even when concealed game seeds are both empty', () => {
		const initial = game();
		const store = new HanabiGameStore(decoded(initial));
		store.receive(decoded({ ...initial, actions: [chat()] }));
		store.receive(
			decoded({
				...initial,
				stage: HanabiStage.Setup,
				currentPlayerId: null,
				actions: [chat('lobby')],
			}),
		);
		expect(store.board.getSnapshot()!.actions).toEqual([]);
		expect(store.board.getSnapshot()!.stage).toBe(HanabiStage.Setup);
		const start = {
			id: 'new-start',
			type: HanabiGameActionType.GameStarted as const,
			startingPlayerId: 'alice',
		};
		store.receive(decoded({ ...initial, actions: [chat('lobby'), start] }));
		expect(store.board.getSnapshot()!.actions).toEqual([start]);
	});

	it('keeps a newly played card detectable after chat has evicted all earlier activity', () => {
		const initial = game();
		const store = new HanabiGameStore(decoded(initial));
		const chats = Array.from({ length: HANABI_MAX_ACTIONS }, (_, index) => chat(`chat-${index}`));
		store.receive(decoded({ ...initial, actions: chats }));
		const played = {
			id: 'play-after-chat',
			type: HanabiGameActionType.Play as const,
			playerId: 'bot',
			tile: initial.tiles.one,
			valid: true,
			remainingLives: 3,
		};
		store.receive(
			decoded({
				...initial,
				playedTiles: ['one'],
				actions: [...chats.slice(1), played],
			}),
		);
		expect(store.board.getSnapshot()!.actions).toEqual([...initial.actions, played]);
	});

	it('takes a replacement round from reconnect without retaining old events', () => {
		const initial = game();
		const store = new HanabiGameStore(decoded(initial));
		const newStart = {
			id: 'reconnected-start',
			type: HanabiGameActionType.GameStarted as const,
			startingPlayerId: 'alice',
		};
		const newPlay = {
			id: 'reconnected-play',
			type: HanabiGameActionType.Play as const,
			playerId: 'alice',
			tile: initial.tiles.one,
			valid: true,
			remainingLives: 3,
		};
		store.receive(decoded({ ...initial, actions: [newStart, newPlay, chat()] }));
		expect(store.board.getSnapshot()!.actions).toEqual([newStart, newPlay]);
	});

	it('refreshes an existing event when the finished snapshot reveals its concealed tiles', () => {
		const initial = game();
		const clue = {
			id: 'clue',
			type: HanabiGameActionType.GiveNumberClue as const,
			playerId: 'alice',
			recipientId: 'bot',
			number: 1 as const,
			tiles: [{ id: 'one', color: 'white' as const, number: 1 as const, concealed: true as const }],
		};
		const store = new HanabiGameStore(decoded({ ...initial, actions: [...initial.actions, clue] }));
		const revealedClue = { ...clue, tiles: [initial.tiles.one] };
		store.receive(
			decoded({
				...initial,
				stage: HanabiStage.Finished,
				finishedReason: HanabiFinishedReason.Won,
				actions: [...initial.actions, revealedClue],
			}),
		);
		expect(store.board.getSnapshot()!.actions).toEqual([...initial.actions, revealedClue]);
	});

	it('stops delivering updates after a subscriber unmounts', () => {
		const initial = game();
		const store = new HanabiGameStore(decoded(initial));
		const onActivity = vi.fn();
		const unsubscribe = store.activity.subscribe(onActivity);
		unsubscribe();
		store.receive(decoded({ ...initial, actions: [...initial.actions, chat()] }));
		expect(onActivity).not.toHaveBeenCalled();
	});
});
