import {
	HANABI_MAX_PLAYERS,
	HanabiGameData,
	HanabiMessage,
	HanabiStage,
	PubSub,
	getScope,
} from '@hanabi/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import HanabiGame, { HanabiGameSerialized } from './HanabiGame.js';
import ServerSocketManager from '../../utils/SocketManager.js';

class FakeSocketManager {
	readonly onMessage = new PubSub<{ userId: string | undefined; message: HanabiMessage }>();
	readonly onAuthenticate = new PubSub<{ userId: string }>();
	readonly onDisconnect = new PubSub<{ userId: string }>();
	readonly sent: Array<{ recipients: string | readonly string[]; message: HanabiMessage }> = [];

	send(recipients: string | readonly string[], message: HanabiMessage) {
		this.sent.push({ recipients, message });
	}

	emit(userId: string, message: HanabiMessage) {
		this.onMessage.emit({ userId, message });
	}
}

function serializedData(game: HanabiGame): HanabiGameData {
	return (JSON.parse(game.serialize()!) as HanabiGameSerialized).data;
}

describe('HanabiGame characterization', () => {
	let sockets: FakeSocketManager;
	let game: HanabiGame;

	beforeEach(() => {
		sockets = new FakeSocketManager();
		game = new HanabiGame('creator', sockets as unknown as ServerSocketManager<HanabiMessage>, {
			saveGame: vi.fn().mockResolvedValue(undefined),
			deleteGame: vi.fn().mockResolvedValue(undefined),
		});
	});

	it('adds players and starts a two-player game through the public message boundary', () => {
		const scope = getScope(game.title, game.id);

		sockets.emit('alice', { scope, type: 'AddPlayerMessage', data: { name: 'Alice' } });
		sockets.emit('bob', { scope, type: 'AddPlayerMessage', data: { name: 'Bob' } });
		sockets.emit('alice', { scope, type: 'StartGameMessage', data: undefined });

		const data = serializedData(game);
		expect(data.stage).toBe(HanabiStage.Playing);
		expect(data.players).toMatchObject({
			alice: { name: 'Alice', connected: true },
			bob: { name: 'Bob', connected: true },
		});
		expect(data.turnOrder).toHaveLength(2);
		expect(data.playerTiles.alice).toHaveLength(5);
		expect(data.playerTiles.bob).toHaveLength(5);
		expect(data.remainingTiles).toHaveLength(40);
		expect(sockets.sent.some(({ message }) => message.type === 'StartGameResponseMessage')).toBe(
			true,
		);
	});

	it('rejects a turn from a user who is not a player without changing game state', () => {
		const scope = getScope(game.title, game.id);
		const before = game.serialize();

		sockets.emit('spectator', {
			scope,
			type: 'DiscardTileMessage',
			data: { id: 'missing-tile' },
		});

		expect(game.serialize()).toBe(before);
		expect(sockets.sent.at(-1)?.message).toMatchObject({
			type: 'DiscardTileResponseMessage',
			data: { error: 'Invalid player!' },
		});
	});

	it("rejects playing another player's tile without changing game state", () => {
		const scope = getScope(game.title, game.id);
		sockets.emit('alice', { scope, type: 'AddPlayerMessage', data: { name: 'Alice' } });
		sockets.emit('bob', { scope, type: 'AddPlayerMessage', data: { name: 'Bob' } });
		sockets.emit('alice', { scope, type: 'StartGameMessage', data: undefined });

		const data = serializedData(game);
		const currentPlayerId = data.currentPlayerId!;
		const otherPlayerId = currentPlayerId === 'alice' ? 'bob' : 'alice';
		const otherPlayerTileId = data.playerTiles[otherPlayerId][0];
		const before = game.serialize();

		sockets.emit(currentPlayerId, {
			scope,
			type: 'PlayTileMessage',
			data: { id: otherPlayerTileId },
		});

		expect(game.serialize()).toBe(before);
		expect(sockets.sent.at(-1)?.message).toMatchObject({
			type: 'PlayTileResponseMessage',
			data: { error: "That tile isn't in your hand!" },
		});
	});

	it('rejects invalid tile positions without applying them', () => {
		const scope = getScope(game.title, game.id);
		sockets.emit('alice', { scope, type: 'AddPlayerMessage', data: { name: 'Alice' } });
		sockets.emit('bob', { scope, type: 'AddPlayerMessage', data: { name: 'Bob' } });
		sockets.emit('alice', { scope, type: 'StartGameMessage', data: undefined });
		const before = serializedData(game);
		const tileId = before.playerTiles.alice[0];

		sockets.emit('alice', {
			scope,
			type: 'MoveTilesMessage',
			data: { [tileId]: { x: -1, y: 0, z: 0 } },
		});

		expect(serializedData(game).tilePositions[tileId]).toEqual(before.tilePositions[tileId]);
		expect(sockets.sent.at(-1)?.message).toMatchObject({
			type: 'MoveTilesResponseMessage',
			data: { error: 'Invalid position.' },
		});
	});

	it('rejects players beyond the supported maximum', () => {
		const scope = getScope(game.title, game.id);
		for (let index = 0; index < HANABI_MAX_PLAYERS; index += 1) {
			sockets.emit(`player-${index}`, {
				scope,
				type: 'AddPlayerMessage',
				data: { name: `Player ${index}` },
			});
		}
		sockets.emit('extra-player', {
			scope,
			type: 'AddPlayerMessage',
			data: { name: 'Extra' },
		});

		expect(Object.keys(serializedData(game).players)).toHaveLength(HANABI_MAX_PLAYERS);
		expect(sockets.sent.at(-1)?.message).toMatchObject({
			type: 'AddPlayerResponseMessage',
			data: { error: `Hanabi supports at most ${HANABI_MAX_PLAYERS} players.` },
		});
	});

	it('rejects malformed tile positions without throwing', () => {
		const scope = getScope(game.title, game.id);
		sockets.emit('alice', { scope, type: 'AddPlayerMessage', data: { name: 'Alice' } });
		sockets.emit('bob', { scope, type: 'AddPlayerMessage', data: { name: 'Bob' } });
		sockets.emit('alice', { scope, type: 'StartGameMessage', data: undefined });
		const data = serializedData(game);
		const tileId = data.playerTiles.alice[0];

		sockets.emit('alice', {
			scope,
			type: 'MoveTilesMessage',
			data: { [tileId]: null } as unknown as Record<string, never>,
		});

		expect(sockets.sent.at(-1)?.message).toMatchObject({
			type: 'MoveTilesResponseMessage',
			data: { error: 'Invalid position.' },
		});
	});

	it('hydrates serialized game data without semantic loss', () => {
		const scope = getScope(game.title, game.id);
		sockets.emit('alice', { scope, type: 'AddPlayerMessage', data: { name: 'Alice' } });
		sockets.emit('bob', { scope, type: 'AddPlayerMessage', data: { name: 'Bob' } });
		const serialized = game.serialize()!;

		const hydrated = new HanabiGame(
			JSON.parse(serialized) as HanabiGameSerialized,
			sockets as unknown as ServerSocketManager<HanabiMessage>,
			{
				saveGame: vi.fn().mockResolvedValue(undefined),
				deleteGame: vi.fn().mockResolvedValue(undefined),
			},
		);

		expect(JSON.parse(hydrated.serialize()!)).toEqual(JSON.parse(serialized));
		hydrated.cleanUp();
	});
});
