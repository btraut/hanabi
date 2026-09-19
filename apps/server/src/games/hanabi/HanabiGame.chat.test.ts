import {
	HANABI_MAX_ACTIONS,
	HanabiStage,
	PubSub,
	getScope,
	type HanabiMessage,
} from '@hanabi/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type ServerSocketManager from '../../utils/SocketManager.js';
import type HanabiGame from './HanabiGame.js';
import type { HanabiGameSerialized } from './HanabiGame.js';
import type { GameTranscriptSnapshot } from './GameTranscript.js';
import HanabiGameFactory from './HanabiGameFactory.js';

const games: HanabiGame[] = [];
afterEach(async () => {
	for (const game of games.splice(0)) {
		game.cleanUp();
		game.stopSaving();
		await game.flushSaves();
	}
});

function saved(game: HanabiGame): HanabiGameSerialized {
	return JSON.parse(game.serialize()!) as HanabiGameSerialized;
}

function harness(serialized?: HanabiGameSerialized) {
	const onMessage = new PubSub<{ userId: string | undefined; message: HanabiMessage }>();
	const sockets = {
		onMessage,
		onAuthenticate: new PubSub(),
		onDisconnect: new PubSub(),
		send: () => undefined,
	} as unknown as ServerSocketManager;
	const recorded: GameTranscriptSnapshot[] = [];
	const factory = new HanabiGameFactory(2, false, {
		record: (transcript) => recorded.push(transcript),
		close: () => Promise.resolve(),
	});
	const store = {
		saveGame: vi.fn().mockResolvedValue(undefined),
		deleteGame: vi.fn().mockResolvedValue(undefined),
	};
	const game = serialized
		? factory.hydrate(JSON.stringify(serialized), sockets, store)
		: factory.create('alice', sockets, store);
	games.push(game);
	const send = (userId: string, message: Omit<HanabiMessage, 'scope'>) =>
		onMessage.emit({
			userId,
			message: { ...message, scope: getScope(game.title, game.id) } as HanabiMessage,
		});
	return { game, send, recorded };
}

function lobby() {
	const context = harness();
	context.send('alice', { type: 'AddPlayerMessage', data: { name: 'Alice' } });
	context.send('bob', { type: 'AddPlayerMessage', data: { name: 'Bob' } });
	return context;
}

describe('durable game chat', () => {
	it('preserves lobby chat beyond the display cap through restart, and archives it with the next round', () => {
		const initial = lobby();
		for (let index = 0; index <= HANABI_MAX_ACTIONS; index += 1) {
			initial.send('alice', { type: 'SendChatMessage', data: `Lobby ${index}` });
		}
		const before = saved(initial.game);
		expect(before.data.actions).toHaveLength(HANABI_MAX_ACTIONS);
		expect(before.pendingChat?.messages).toHaveLength(HANABI_MAX_ACTIONS + 1);
		const restored = harness(before);
		restored.send('alice', { type: 'StartGameMessage', data: undefined });
		const transcript = restored.recorded.at(-1)!;
		expect(transcript.chat?.coverage).toBe('complete');
		expect(transcript.chat?.messages).toEqual(before.pendingChat?.messages);
		expect(transcript.chat?.messages[0]).toMatchObject({
			actorId: 'alice',
			actorName: 'Alice',
			actorKind: 'human',
			message: 'Lobby 0',
			afterMoveIndex: 0,
		});
	});

	it('records chat around accepted moves and after game end, preserves it across reset, and rejects invalid chat', () => {
		const context = lobby();
		context.send('alice', { type: 'StartGameMessage', data: undefined });
		context.send('watcher', { type: 'SendChatMessage', data: 'Not seated' });
		context.send('alice', { type: 'SendChatMessage', data: '' });
		context.send('alice', { type: 'SendChatMessage', data: 'Before play' });
		let state = saved(context.game);
		for (let turn = 0; turn < 100 && state.data.stage !== HanabiStage.Finished; turn += 1) {
			const actor = state.data.currentPlayerId!;
			context.send(actor, {
				type: 'PlayTileMessage',
				data: { id: state.data.playerTiles[actor][0] },
			});
			state = saved(context.game);
		}
		expect(state.data.stage).toBe(HanabiStage.Finished);
		const endedAt = state.transcript!.lifecycle.endedAt;
		context.send('bob', { type: 'SendChatMessage', data: 'After game' });
		const archived = context.recorded.at(-1)!;
		expect(archived.chat?.messages).toHaveLength(2);
		expect(archived.chat?.messages[0].afterMoveIndex).toBe(0);
		expect(archived.chat?.messages[1]).toMatchObject({
			message: 'After game',
			afterMoveIndex: archived.moves.length,
		});
		expect(archived.lifecycle.endedAt).toBe(endedAt);
		context.send('alice', { type: 'ResetGameMessage', data: undefined });
		context.send('alice', { type: 'SendChatMessage', data: 'Next lobby' });
		context.send('alice', { type: 'StartGameMessage', data: undefined });
		expect(context.recorded.at(-1)?.roundId).not.toBe(archived.roundId);
		expect(context.recorded.at(-1)?.chat?.messages.map(({ message }) => message)).toEqual([
			'Next lobby',
		]);
		expect(archived.chat?.messages).toHaveLength(2);
	});

	it('labels legacy active and lobby chat partial without inventing missing messages', () => {
		const initial = lobby();
		const legacyLobby = saved(initial.game);
		delete legacyLobby.pendingChat;
		const restoredLobby = harness(legacyLobby);
		restoredLobby.send('alice', { type: 'StartGameMessage', data: undefined });
		expect(saved(restoredLobby.game).transcript?.chat?.coverage).toBe('partial');
		const legacyRound = saved(restoredLobby.game);
		delete legacyRound.transcript!.chat;
		const restoredRound = harness(legacyRound);
		expect(saved(restoredRound.game).transcript?.chat).toBeUndefined();
		restoredRound.send('alice', { type: 'SendChatMessage', data: 'Captured from here' });
		expect(restoredRound.recorded.at(-1)?.chat).toMatchObject({
			coverage: 'partial',
			messages: [{ message: 'Captured from here' }],
		});
	});

	it('hydrates validated chat larger than the ordinary envelope while rejecting malformed or oversized messages', () => {
		const initial = lobby();
		initial.send('alice', { type: 'SendChatMessage', data: 'A message' });
		const large = saved(initial.game);
		const first = large.pendingChat!.messages[0];
		large.pendingChat!.messages = Array.from({ length: 4000 }, (_, index) => ({
			...first,
			id: `message-${index}`,
			message: 'x'.repeat(500),
		}));
		expect(Buffer.byteLength(JSON.stringify(large))).toBeGreaterThan(2 * 1024 * 1024);
		expect(saved(harness(large).game).pendingChat?.messages).toHaveLength(4000);
		large.pendingChat!.messages[0].message = 'x'.repeat(501);
		expect(() => harness(large)).toThrow('must contain between 1 and 500');
		large.pendingChat!.messages[0].message = 'valid';
		large.pendingChat!.messages[0].afterMoveIndex = 1;
		expect(() => harness(large)).toThrow('must be an integer between 0 and 0');
	});
});
