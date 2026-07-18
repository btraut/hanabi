import {
	HANABI_MAX_ACTIONS,
	HANABI_MAX_CHAT_LENGTH,
	HANABI_MAX_PLAYERS,
	HanabiGameData,
	HanabiFinishedReason,
	HanabiGameActionType,
	HanabiMessage,
	HanabiRuleSet,
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

function refreshFor(sockets: FakeSocketManager, userId: string): HanabiGameData {
	const sent = [...sockets.sent]
		.reverse()
		.find(
			({ recipients, message }) =>
				recipients === userId && message.type === 'RefreshGameDataMessage',
		);
	if (!sent || sent.message.type !== 'RefreshGameDataMessage') {
		throw new Error(`No game snapshot was sent to ${userId}.`);
	}
	return sent.message.data;
}

function hydrateForTest(serialized: HanabiGameSerialized, sockets: FakeSocketManager): HanabiGame {
	return new HanabiGame(serialized, sockets as unknown as ServerSocketManager, {
		saveGame: vi.fn().mockResolvedValue(undefined),
		deleteGame: vi.fn().mockResolvedValue(undefined),
	});
}

describe('HanabiGame characterization', () => {
	let sockets: FakeSocketManager;
	let game: HanabiGame;

	beforeEach(() => {
		sockets = new FakeSocketManager();
		game = new HanabiGame('creator', sockets as unknown as ServerSocketManager, {
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

	it('returns stable errors for malformed command payloads', () => {
		const scope = getScope(game.title, game.id);
		sockets.emit('alice', {
			scope,
			type: 'GetGameDataMessage',
			data: {},
		} as unknown as HanabiMessage);
		expect(sockets.sent.at(-1)?.message.type).toBe('RefreshGameDataMessage');

		const malformedCommands: Array<{ message: HanabiMessage; responseType: string }> = [
			{
				message: { scope, type: 'AddPlayerMessage', data: null } as unknown as HanabiMessage,
				responseType: 'AddPlayerResponseMessage',
			},
			{
				message: {
					scope,
					type: 'RemovePlayerMessage',
					data: { playerId: 7 },
				} as unknown as HanabiMessage,
				responseType: 'RemovePlayerResponseMessage',
			},
			{
				message: {
					scope,
					type: 'ChangeGameSettingsMessage',
					data: { showNotes: 'false' },
				} as unknown as HanabiMessage,
				responseType: 'ChangeGameSettingsResponseMessage',
			},
			{
				message: { scope, type: 'SendChatMessage', data: {} } as unknown as HanabiMessage,
				responseType: 'SendChatResponseMessage',
			},
			{
				message: { scope, type: 'StartGameMessage', data: {} } as unknown as HanabiMessage,
				responseType: 'StartGameResponseMessage',
			},
			{
				message: { scope, type: 'ResetGameMessage', data: {} } as unknown as HanabiMessage,
				responseType: 'ResetGameResponseMessage',
			},
			{
				message: { scope, type: 'PlayTileMessage', data: null } as unknown as HanabiMessage,
				responseType: 'PlayTileResponseMessage',
			},
			{
				message: { scope, type: 'DiscardTileMessage', data: null } as unknown as HanabiMessage,
				responseType: 'DiscardTileResponseMessage',
			},
			{
				message: { scope, type: 'GiveClueMessage', data: null } as unknown as HanabiMessage,
				responseType: 'GiveClueResponseMessage',
			},
			{
				message: { scope, type: 'MoveTilesMessage', data: null } as unknown as HanabiMessage,
				responseType: 'MoveTilesResponseMessage',
			},
		];

		for (const { message, responseType } of malformedCommands) {
			expect(() => sockets.emit('alice', message)).not.toThrow();
			expect(sockets.sent.at(-1)?.message).toMatchObject({
				type: responseType,
				data: { error: 'Invalid message payload.' },
			});
		}
	});

	it('rejects mixed invalid settings without partially mutating state', () => {
		const scope = getScope(game.title, game.id);
		sockets.emit('alice', { scope, type: 'AddPlayerMessage', data: { name: 'Alice' } });
		const before = serializedData(game);

		sockets.emit('alice', {
			scope,
			type: 'ChangeGameSettingsMessage',
			data: { ruleSet: '6-color', allowDragging: 'false' },
		} as unknown as HanabiMessage);

		expect(serializedData(game)).toEqual(before);
		expect(sockets.sent.at(-1)?.message).toMatchObject({
			type: 'ChangeGameSettingsResponseMessage',
			data: { error: 'Invalid message payload.' },
		});
	});

	it('enforces explicit chat bounds and caps retained actions', () => {
		const scope = getScope(game.title, game.id);
		sockets.emit('alice', { scope, type: 'AddPlayerMessage', data: { name: 'Alice' } });

		for (const invalidChat of ['', ' '.repeat(3), 'x'.repeat(HANABI_MAX_CHAT_LENGTH + 1)]) {
			sockets.emit('alice', { scope, type: 'SendChatMessage', data: invalidChat });
			expect(sockets.sent.at(-1)?.message).toMatchObject({
				type: 'SendChatResponseMessage',
				data: {
					error: `Chat messages must be between 1 and ${HANABI_MAX_CHAT_LENGTH} characters.`,
				},
			});
		}

		const serialized = JSON.parse(game.serialize()!) as HanabiGameSerialized;
		serialized.data.actions = Array.from({ length: HANABI_MAX_ACTIONS }, (_, index) => ({
			id: `chat-${index}`,
			type: 'Chat',
			playerId: 'alice',
			message: `message-${index}`,
		})) as HanabiGameData['actions'];
		const cappedGame = hydrateForTest(serialized, sockets);
		const cappedScope = getScope(cappedGame.title, cappedGame.id);

		sockets.emit('alice', { scope: cappedScope, type: 'SendChatMessage', data: 'newest' });
		const actions = serializedData(cappedGame).actions;
		expect(actions).toHaveLength(HANABI_MAX_ACTIONS);
		expect(actions.at(0)).toMatchObject({ id: 'chat-1' });
		expect(actions.at(-1)).toMatchObject({ message: 'newest' });
		cappedGame.cleanUp();
	});

	it.each(['5-color', 'rainbow'] satisfies HanabiRuleSet[])(
		'rejects purple clues in the %s ruleset',
		(ruleSet) => {
			const scope = getScope(game.title, game.id);
			sockets.emit('alice', { scope, type: 'AddPlayerMessage', data: { name: 'Alice' } });
			sockets.emit('bob', { scope, type: 'AddPlayerMessage', data: { name: 'Bob' } });
			sockets.emit('alice', {
				scope,
				type: 'ChangeGameSettingsMessage',
				data: { ruleSet },
			});
			sockets.emit('alice', { scope, type: 'StartGameMessage', data: undefined });
			const data = serializedData(game);
			const playerId = data.currentPlayerId!;
			const recipientId = playerId === 'alice' ? 'bob' : 'alice';

			sockets.emit(playerId, {
				scope,
				type: 'GiveClueMessage',
				data: { to: recipientId, color: 'purple' },
			});

			expect(sockets.sent.at(-1)?.message).toMatchObject({
				type: 'GiveClueResponseMessage',
				data: { error: 'Invalid clue.' },
			});
		},
	);

	it('accepts purple clues in the six-color ruleset', () => {
		const scope = getScope(game.title, game.id);
		sockets.emit('alice', { scope, type: 'AddPlayerMessage', data: { name: 'Alice' } });
		sockets.emit('bob', { scope, type: 'AddPlayerMessage', data: { name: 'Bob' } });
		sockets.emit('alice', {
			scope,
			type: 'ChangeGameSettingsMessage',
			data: { ruleSet: '6-color' },
		});
		sockets.emit('alice', { scope, type: 'StartGameMessage', data: undefined });
		const serialized = JSON.parse(game.serialize()!) as HanabiGameSerialized;
		const playerId = serialized.data.currentPlayerId!;
		const recipientId = playerId === 'alice' ? 'bob' : 'alice';
		const recipientTileId = serialized.data.playerTiles[recipientId][0];
		serialized.data = {
			...serialized.data,
			tiles: {
				...serialized.data.tiles,
				[recipientTileId]: {
					...serialized.data.tiles[recipientTileId],
					color: 'purple',
				},
			},
		};
		const sixColorGame = hydrateForTest(serialized, sockets);
		const sixColorScope = getScope(sixColorGame.title, sixColorGame.id);

		sockets.emit(playerId, {
			scope: sixColorScope,
			type: 'GiveClueMessage',
			data: { to: recipientId, color: 'purple' },
		});

		const response = [...sockets.sent]
			.reverse()
			.find(({ message }) => message.type === 'GiveClueResponseMessage');
		expect(response?.message).toMatchObject({
			type: 'GiveClueResponseMessage',
			data: {},
		});
		expect(serializedData(sixColorGame).clues).toBe(serialized.data.clues - 1);
		sixColorGame.cleanUp();
	});

	it('sends recipient-specific snapshots and reveals complete state when finished', () => {
		const scope = getScope(game.title, game.id);
		sockets.emit('alice', { scope, type: 'AddPlayerMessage', data: { name: 'Alice' } });
		sockets.emit('bob', { scope, type: 'AddPlayerMessage', data: { name: 'Bob' } });
		sockets.emit('alice', { scope, type: 'StartGameMessage', data: undefined });
		game.watchers.push('watcher');
		let complete = serializedData(game);
		const clueGiverId = complete.currentPlayerId!;
		const clueRecipientId = clueGiverId === 'alice' ? 'bob' : 'alice';
		const clueTile = complete.tiles[complete.playerTiles[clueRecipientId][0]];
		sockets.emit(clueGiverId, {
			scope,
			type: 'GiveClueMessage',
			data: { to: clueRecipientId, color: clueTile.color },
		});
		complete = serializedData(game);

		sockets.emit('alice', { scope, type: 'GetGameDataMessage', data: undefined });
		sockets.emit('watcher', { scope, type: 'GetGameDataMessage', data: undefined });
		const aliceSnapshot = refreshFor(sockets, 'alice');
		const watcherSnapshot = refreshFor(sockets, 'watcher');
		const aliceTileId = complete.playerTiles.alice[0];
		const bobTileId = complete.playerTiles.bob[0];
		const deckTileId = complete.remainingTiles[0];

		expect(aliceSnapshot.tiles[aliceTileId]).toMatchObject({
			id: aliceTileId,
			concealed: true,
		});
		expect(aliceSnapshot.tiles[bobTileId]).toEqual(complete.tiles[bobTileId]);
		expect(aliceSnapshot.tiles[deckTileId]).toMatchObject({ id: deckTileId, concealed: true });
		expect(aliceSnapshot.seed).toBe('');
		expect(watcherSnapshot.tiles[aliceTileId]).toEqual(complete.tiles[aliceTileId]);
		expect(watcherSnapshot.tiles[bobTileId]).toEqual(complete.tiles[bobTileId]);
		expect(watcherSnapshot.tiles[deckTileId]).toMatchObject({ id: deckTileId, concealed: true });
		const clueAction = aliceSnapshot.actions.find(
			(action) =>
				action.type === HanabiGameActionType.GiveColorClue ||
				action.type === HanabiGameActionType.GiveNumberClue,
		);
		expect(clueAction).toBeDefined();
		if (
			clueAction?.type === HanabiGameActionType.GiveColorClue ||
			clueAction?.type === HanabiGameActionType.GiveNumberClue
		) {
			expect(clueAction.tiles.length).toBeGreaterThan(0);
			expect(clueAction.tiles.every((tile) => tile.concealed)).toBe(true);
		}

		const finishedSerialized = JSON.parse(game.serialize()!) as HanabiGameSerialized;
		finishedSerialized.data.stage = HanabiStage.Finished;
		finishedSerialized.data.finishedReason = HanabiFinishedReason.OutOfLives;
		const finishedGame = hydrateForTest(finishedSerialized, sockets);
		const finishedScope = getScope(finishedGame.title, finishedGame.id);
		sockets.emit('alice', { scope: finishedScope, type: 'GetGameDataMessage', data: undefined });

		expect(refreshFor(sockets, 'alice').tiles).toEqual(finishedSerialized.data.tiles);
		expect(refreshFor(sockets, 'alice').seed).toBe(finishedSerialized.data.seed);
		finishedGame.cleanUp();
	});

	it('hydrates serialized game data with all players initially disconnected', () => {
		const scope = getScope(game.title, game.id);
		sockets.emit('alice', { scope, type: 'AddPlayerMessage', data: { name: 'Alice' } });
		sockets.emit('bob', { scope, type: 'AddPlayerMessage', data: { name: 'Bob' } });
		const serialized = game.serialize()!;

		const hydrated = new HanabiGame(
			JSON.parse(serialized) as HanabiGameSerialized,
			sockets as unknown as ServerSocketManager,
			{
				saveGame: vi.fn().mockResolvedValue(undefined),
				deleteGame: vi.fn().mockResolvedValue(undefined),
			},
		);

		expect(serializedData(hydrated)).toEqual({
			...(JSON.parse(serialized) as HanabiGameSerialized).data,
			players: {
				alice: { id: 'alice', name: 'Alice', connected: false },
				bob: { id: 'bob', name: 'Bob', connected: false },
			},
		});
		hydrated.cleanUp();
	});
});
