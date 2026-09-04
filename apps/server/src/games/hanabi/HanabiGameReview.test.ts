import {
	getScope,
	HanabiGameData,
	HanabiMessage,
	HanabiStage,
	PubSub,
	replayHanabiTranscript,
} from '@hanabi/shared';
import { describe, expect, it, vi } from 'vitest';
import ServerSocketManager from '../../utils/SocketManager.js';
import HanabiGame, { HanabiGameSerialized } from './HanabiGame.js';

class ReviewSockets {
	readonly onMessage = new PubSub<{ userId: string | undefined; message: HanabiMessage }>();
	readonly onAuthenticate = new PubSub<{ userId: string }>();
	readonly onDisconnect = new PubSub<{ userId: string }>();
	readonly sent: Array<{ recipients: string | readonly string[]; message: HanabiMessage }> = [];

	send(recipients: string | readonly string[], message: HanabiMessage) {
		this.sent.push({ recipients, message: structuredClone(message) });
	}
}

function snapshot(game: HanabiGame): HanabiGameSerialized {
	return JSON.parse(game.serialize()!) as HanabiGameSerialized;
}

function createGame(serialized?: HanabiGameSerialized) {
	const sockets = new ReviewSockets();
	const game = new HanabiGame(serialized ?? 'alice', sockets as unknown as ServerSocketManager, {
		saveGame: vi.fn(),
		deleteGame: vi.fn(),
	});
	const scope = getScope(game.title, game.id);
	const emit = (userId: string, message: HanabiMessage) => {
		sockets.onMessage.emit({ userId, message: { ...message, scope } });
	};
	const read = (userId: string): HanabiGameData => {
		emit(userId, { scope, type: 'GetGameDataMessage', data: undefined });
		const response = sockets.sent.at(-1)!;
		if (response.message.type !== 'RefreshGameDataMessage') {
			throw new Error('Expected a game snapshot.');
		}
		return response.message.data;
	};
	return { game, sockets, emit, read, scope };
}

function startGame() {
	const context = createGame();
	const { emit, scope } = context;
	for (const [id, name] of [
		['alice', 'Alice'],
		['ben', 'Ben'],
		['chika', 'Chika'],
	]) {
		emit(id, { scope, type: 'AddPlayerMessage', data: { name } });
	}
	emit('alice', {
		scope,
		type: 'ChangeGameSettingsMessage',
		data: { criticalGameOver: false, ruleSet: '5-color' },
	});
	emit('alice', { scope, type: 'StartGameMessage', data: undefined });
	return context;
}

function finishGame(context: ReturnType<typeof createGame>) {
	const { game, emit, scope } = context;
	const moments: HanabiGameData[] = [];
	for (let turn = 0; turn < 100; turn += 1) {
		const data = snapshot(game).data;
		moments.push(data);
		if (data.stage === HanabiStage.Finished) return moments;
		const actorId = data.currentPlayerId!;
		if (turn < 12 && turn % 2 === 0) {
			const recipient = data.turnOrder.find((id) => id !== actorId)!;
			const tile = data.tiles[data.playerTiles[recipient][0]];
			emit(actorId, {
				scope,
				type: 'GiveClueMessage',
				data: { to: recipient, number: tile.number },
			});
		} else {
			emit(actorId, {
				scope,
				type: turn < 12 ? 'DiscardTileMessage' : 'PlayTileMessage',
				data: { id: data.playerTiles[actorId][0] },
			});
		}
	}
	throw new Error('Scripted game failed to finish.');
}

describe('finished game review delivery', () => {
	it('reconstructs every accepted move from actual server gameplay', () => {
		const context = startGame();
		const moments = finishGame(context);
		const transcript = snapshot(context.game).transcript!;
		for (const [cursor, moment] of moments.entries()) {
			expect(replayHanabiTranscript(transcript, cursor)).toMatchObject({
				stage: moment.stage,
				finishedReason: moment.finishedReason,
				playerTiles: moment.playerTiles,
				remainingTiles: moment.remainingTiles,
				playedTiles: moment.playedTiles,
				discardedTiles: moment.discardedTiles,
				tileNotes: moment.tileNotes,
				clues: moment.clues,
				lives: moment.lives,
				currentPlayerId: moment.currentPlayerId,
				remainingTurns: moment.remainingTurns,
			});
		}
		context.game.cleanUp();
	});
	it('keeps complete live transcripts off every player and watcher snapshot', () => {
		const context = startGame();
		const persisted = snapshot(context.game);
		expect(persisted.transcript?.integrity.status).toBe('complete');
		for (const userId of ['alice', 'ben', 'chika', 'watcher']) {
			const received = context.read(userId);
			expect(received.reviewTranscript).toBeUndefined();
			expect(received.seed).toBe('');
			expect(received.tiles[received.remainingTiles[0]].concealed).toBe(true);
			for (const tileId of received.playerTiles[userId] ?? []) {
				expect(received.tiles[tileId].concealed).toBe(true);
			}
		}
		context.game.cleanUp();
	});

	it('delivers a complete finished round to players and watchers without persisting recipient data', () => {
		const context = startGame();
		finishGame(context);
		const persisted = snapshot(context.game);
		expect(persisted.data.stage).toBe(HanabiStage.Finished);
		const broadcast = context.sockets.sent.filter(
			({ message }) => message.type === 'RefreshGameDataMessage' && message.data.reviewTranscript,
		);
		expect(broadcast.map(({ recipients }) => recipients)).toEqual(['alice', 'ben', 'chika']);
		expect(persisted.transcript?.moves.length).toBeGreaterThanOrEqual(15);
		expect(new Set(persisted.transcript!.moves.map((move) => move.type))).toEqual(
			new Set(['clue', 'discard', 'play']),
		);
		for (const userId of ['alice', 'ben', 'chika', 'watcher']) {
			expect(context.read(userId).reviewTranscript).toEqual(persisted.transcript);
		}
		expect(snapshot(context.game).data.reviewTranscript).toBeUndefined();
		context.game.cleanUp();

		const reconnected = createGame(persisted);
		expect(reconnected.read('alice').reviewTranscript).toEqual(persisted.transcript);
		reconnected.game.cleanUp();
	});

	it('removes review data when resetting and starting the next round', () => {
		const context = startGame();
		finishGame(context);
		expect(context.read('alice').reviewTranscript).toBeDefined();
		context.emit('alice', { scope: context.scope, type: 'ResetGameMessage', data: undefined });
		expect(context.read('alice').reviewTranscript).toBeUndefined();
		context.emit('alice', { scope: context.scope, type: 'StartGameMessage', data: undefined });
		expect(context.read('alice').reviewTranscript).toBeUndefined();
		context.game.cleanUp();
	});

	it.each(['reset', 'in_progress', 'conflicted', 'missing-deck', 'missing-deal'])(
		'does not deliver an ineligible %s transcript even with a finished board',
		(ineligible) => {
			const context = startGame();
			finishGame(context);
			const persisted = snapshot(context.game);
			context.game.cleanUp();
			const transcript = persisted.transcript!;
			if (ineligible === 'reset' || ineligible === 'in_progress') {
				transcript.lifecycle.status = ineligible;
			} else if (ineligible === 'conflicted') {
				transcript.integrity.status = 'conflicted';
			} else if (ineligible === 'missing-deck') {
				transcript.deck = null;
			} else {
				transcript.dealOrder = null;
			}
			const restored = createGame(persisted);
			expect(restored.read('alice').reviewTranscript).toBeUndefined();
			restored.game.cleanUp();
		},
	);

	it('does not offer partial legacy rounds or carry a stale recipient transcript into live state', () => {
		const context = startGame();
		const live = snapshot(context.game);
		finishGame(context);
		const finished = snapshot(context.game);
		context.game.cleanUp();

		delete finished.transcript;
		const legacy = createGame(finished);
		expect(snapshot(legacy.game).transcript?.integrity.status).toBe('partial');
		expect(legacy.read('alice').reviewTranscript).toBeUndefined();
		legacy.game.cleanUp();

		live.data.reviewTranscript = live.transcript!;
		const restored = createGame(live);
		expect(restored.read('alice').reviewTranscript).toBeUndefined();
		expect(snapshot(restored.game).data.reviewTranscript).toBeUndefined();
		restored.game.cleanUp();
	});
});
