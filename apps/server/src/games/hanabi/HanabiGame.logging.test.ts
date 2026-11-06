import { getScope, HANABI_GAME_TITLE, HanabiMessage, HanabiStage, PubSub } from '@hanabi/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Logger from '../../utils/Logger.js';
import { createHash } from 'node:crypto';
import SocketManager from '../../utils/SocketManager.js';
import HanabiGame, { HanabiGameSerialized } from './HanabiGame.js';

class LoggingSockets {
	readonly onMessage = new PubSub<{ socketId: string; userId: string; message: HanabiMessage }>();
	readonly onAuthenticate = new PubSub<{ userId: string }>();
	readonly onDisconnect = new PubSub<{ userId: string }>();
	readonly send = vi.fn();
	readonly sendToSocket = vi.fn();
}

const games: HanabiGame[] = [];
function createGame(serialized?: HanabiGameSerialized) {
	const sockets = new LoggingSockets();
	const game = new HanabiGame(serialized ?? 'host', sockets as unknown as SocketManager, {
		saveGame: vi.fn().mockResolvedValue(undefined),
		deleteGame: vi.fn().mockResolvedValue(undefined),
	});
	games.push(game);
	const emit = (userId: string, message: { type: string; data?: unknown }) =>
		sockets.onMessage.emit({
			userId,
			socketId: `${userId}-socket`,
			message: { ...message, scope: getScope(HANABI_GAME_TITLE, game.id) } as HanabiMessage,
		});
	const join = (id: string, name: string) => emit(id, { type: 'AddPlayerMessage', data: { name } });
	return { game, sockets, emit, join };
}
function snapshot(game: HanabiGame): HanabiGameSerialized {
	return JSON.parse(game.serialize()!) as HanabiGameSerialized;
}

const capturedEvents = vi.fn<typeof Logger.event>();
beforeEach(() => {
	capturedEvents.mockClear();
	vi.spyOn(Logger, 'event').mockImplementation(capturedEvents);
});
afterEach(async () => {
	for (const game of games.splice(0)) {
		game.stopSaving();
		await game.flushSaves();
		game.cleanUp();
	}
	vi.restoreAllMocks();
});
function events(name: string) {
	return capturedEvents.mock.calls.filter(([event]) => event === name).map(([, fields]) => fields!);
}

describe('Hanabi identity diagnostics', () => {
	it('distinguishes same-name identities, same-ID updates and normalized duplicate warnings', () => {
		const { game, join } = createGame();
		join('host', 'weish');
		join('guest', ' Weish ');
		expect(Object.keys(snapshot(game).data.players)).toEqual(['host', 'guest']);
		expect(events('game.duplicate_player_name')).toEqual([
			expect.objectContaining({
				gameId: game.id,
				gameCode: game.code,
				userId: 'guest',
				socketId: 'guest-socket',
				name: 'Weish',
				matchingPlayerIds: ['host'],
				rosterBefore: [expect.objectContaining({ id: 'host', name: 'weish' })],
				rosterAfter: [
					expect.objectContaining({ id: 'host' }),
					expect.objectContaining({ id: 'guest' }),
				],
			}),
		]);
		join('guest', 'aaron');
		expect(events('game.player_updated')).toEqual([
			expect.objectContaining({
				userId: 'guest',
				previousName: 'Weish',
				name: 'aaron',
			}),
		]);
		expect(Object.keys(snapshot(game).data.players)).toEqual(['host', 'guest']);
		join('host', 'weish');
		expect(events('game.duplicate_player_name')).toHaveLength(1);
	});

	it('retains the disconnected seat and logs only meaningful presence transitions', () => {
		const { game, sockets, join } = createGame();
		join('host', 'weish');
		sockets.onDisconnect.emit({ userId: 'host' });
		sockets.onDisconnect.emit({ userId: 'host' });
		expect(snapshot(game).data.players.host).toMatchObject({ name: 'weish', connected: false });
		expect(events('game.player_connection_changed')).toHaveLength(1);
		expect(events('game.player_connection_changed')[0]).toMatchObject({
			userId: 'host',
			previousConnected: true,
			connected: false,
		});
		sockets.onAuthenticate.emit({ userId: 'host' });
		expect(events('game.player_connection_changed')).toHaveLength(2);
	});

	it('records a rejected removal after start without changing the roster or logging private game data', () => {
		const { game, join, emit, sockets } = createGame();
		join('host', 'weish');
		join('guest', 'aaron');
		emit('host', { type: 'StartGameMessage' });
		const before = snapshot(game);
		expect(before.data.stage).toBe(HanabiStage.Playing);
		emit('host', { type: 'RemovePlayerMessage', data: { playerId: 'guest' } });
		expect(snapshot(game).data.players).toEqual(before.data.players);
		expect(events('game.player_remove_rejected')[0]).toMatchObject({
			targetPlayerId: 'guest',
			targetName: 'aaron',
		});
		expect(events('game.request_rejected')[0]).toMatchObject({
			gameCode: game.code,
			userId: 'host',
			socketId: 'host-socket',
			requestType: 'RemovePlayerMessage',
			reason: 'Cannot remove user from game because it has already started.',
		});
		expect(sockets.sendToSocket).toHaveBeenLastCalledWith(
			'host-socket',
			expect.objectContaining({
				type: 'RemovePlayerResponseMessage',
				data: { error: 'Cannot remove user from game because it has already started.' },
			}),
		);
		emit('host', { type: 'RemovePlayerMessage', data: { playerId: 'private-token-sentinel' } });
		const logs = JSON.stringify(capturedEvents.mock.calls);
		expect(logs).not.toContain('private-token-sentinel');
		for (const tile of Object.values(before.data.tiles)) expect(logs).not.toContain(tile.id);
		for (const field of ['playerTiles', 'remainingTiles', 'tileNotes', 'token', 'cookie', 'chat'])
			expect(logs).not.toContain(`"${field}"`);
	});

	it('records successful removal, start/reset round boundaries and restore connectivity', () => {
		const { game, join, emit } = createGame();
		join('host', 'weish');
		join('guest', 'aaron');
		emit('host', { type: 'RemovePlayerMessage', data: { playerId: 'guest' } });
		expect(events('game.player_removed')[0]).toMatchObject({
			removed: true,
			targetPlayerId: 'guest',
			rosterAfter: [expect.objectContaining({ id: 'host' })],
		});
		join('guest', 'aaron');
		emit('host', { type: 'StartGameMessage' });
		const previousSeed = snapshot(game).data.seed;
		const previousRoundRef = createHash('sha256').update(previousSeed).digest('hex');
		expect(events('game.started')[0]).toMatchObject({
			roundRef: previousRoundRef,
			stage: HanabiStage.Playing,
		});
		emit('host', { type: 'ResetGameMessage' });
		expect(events('game.reset')[0]).toMatchObject({
			previousRoundRef,
			previousStage: HanabiStage.Playing,
			stage: HanabiStage.Setup,
			rosterAfter: [
				expect.objectContaining({ id: 'host' }),
				expect.objectContaining({ id: 'guest' }),
			],
		});
		const { game: restored } = createGame(snapshot(game));
		expect(events('game.restored')[0]).toMatchObject({
			gameId: game.id,
			gameCode: game.code,
			rosterBefore: [
				expect.objectContaining({ id: 'host', connected: true }),
				expect.objectContaining({ id: 'guest', connected: true }),
			],
			rosterAfter: [
				expect.objectContaining({ id: 'host', connected: false }),
				expect.objectContaining({ id: 'guest', connected: false }),
			],
		});
		expect(snapshot(restored).data.players.host.connected).toBe(false);
		const resetSeed = snapshot(game).data.seed;
		expect(events('game.reset')[0].roundRef).toBe(
			createHash('sha256').update(resetSeed).digest('hex'),
		);
		const logs = JSON.stringify(capturedEvents.mock.calls);
		expect(logs).not.toContain(previousSeed);
		expect(logs).not.toContain(resetSeed);
		expect(logs).not.toContain('roundId');
	});
});
