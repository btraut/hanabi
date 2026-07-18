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
	HanabiTile,
	PubSub,
	generateHanabiGameData,
	generatePlayer,
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

function playingData(data: Partial<HanabiGameData> = {}): HanabiGameData {
	return generateHanabiGameData({
		ruleSet: 'black-powder',
		stage: HanabiStage.Playing,
		players: {
			alice: generatePlayer({ id: 'alice', name: 'Alice' }),
			bob: generatePlayer({ id: 'bob', name: 'Bob' }),
		},
		currentPlayerId: 'alice',
		turnOrder: ['alice', 'bob'],
		playerTiles: { alice: [], bob: [] },
		criticalGameOver: false,
		...data,
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

	function replaceGameData(data: HanabiGameData): void {
		const serialized = JSON.parse(game.serialize()!) as HanabiGameSerialized;
		game.cleanUp();
		game = new HanabiGame(
			{ ...serialized, data: structuredClone(data) },
			sockets as unknown as ServerSocketManager,
			{
				saveGame: vi.fn().mockResolvedValue(undefined),
				deleteGame: vi.fn().mockResolvedValue(undefined),
			},
		);
	}

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

	it('starts Black Powder with the official 60-tile deck', () => {
		const scope = getScope(game.title, game.id);

		sockets.emit('alice', { scope, type: 'AddPlayerMessage', data: { name: 'Alice' } });
		sockets.emit('bob', { scope, type: 'AddPlayerMessage', data: { name: 'Bob' } });
		sockets.emit('alice', {
			scope,
			type: 'ChangeGameSettingsMessage',
			data: { ruleSet: 'black-powder' },
		});
		sockets.emit('alice', { scope, type: 'StartGameMessage', data: undefined });

		const data = serializedData(game);
		expect(data.ruleSet).toBe('black-powder');
		expect(Object.values(data.tiles).filter((tile) => tile.color === 'black')).toHaveLength(10);
		expect(data.remainingTiles).toHaveLength(50);
	});

	it('starts combined Decoy Rainbow and Black Powder with all seven suits', () => {
		const scope = getScope(game.title, game.id);

		sockets.emit('alice', { scope, type: 'AddPlayerMessage', data: { name: 'Alice' } });
		sockets.emit('bob', { scope, type: 'AddPlayerMessage', data: { name: 'Bob' } });
		sockets.emit('alice', {
			scope,
			type: 'ChangeGameSettingsMessage',
			data: { ruleSet: 'rainbow-black-powder' },
		});
		sockets.emit('alice', { scope, type: 'StartGameMessage', data: undefined });

		const data = serializedData(game);
		expect(data.ruleSet).toBe('rainbow-black-powder');
		expect(Object.values(data.tiles).filter((tile) => tile.color === 'rainbow')).toHaveLength(10);
		expect(Object.values(data.tiles).filter((tile) => tile.color === 'black')).toHaveLength(10);
		expect(data.remainingTiles).toHaveLength(60);
	});

	it('plays the black firework downward and rejects an out-of-order black tile', () => {
		const scope = getScope(game.title, game.id);
		const black5: HanabiTile = { id: 'black-5', color: 'black', number: 5 };
		const black4: HanabiTile = { id: 'black-4', color: 'black', number: 4 };
		replaceGameData(
			playingData({
				tiles: { [black5.id]: black5, [black4.id]: black4 },
				playerTiles: { alice: [black5.id], bob: [black4.id] },
			}),
		);

		sockets.emit('alice', { scope, type: 'PlayTileMessage', data: { id: black5.id } });
		sockets.emit('bob', { scope, type: 'PlayTileMessage', data: { id: black4.id } });

		expect(serializedData(game).playedTiles).toEqual([black5.id, black4.id]);
		expect(serializedData(game).lives).toBe(3);

		replaceGameData(
			playingData({
				tiles: { [black4.id]: black4 },
				playerTiles: { alice: [black4.id], bob: [] },
			}),
		);

		sockets.emit('alice', { scope, type: 'PlayTileMessage', data: { id: black4.id } });

		expect(serializedData(game).playedTiles).toEqual([]);
		expect(serializedData(game).discardedTiles).toEqual([black4.id]);
		expect(serializedData(game).lives).toBe(2);
	});

	it('restores a clue when black 1 completes the reversed firework', () => {
		const scope = getScope(game.title, game.id);
		const blackTiles = Object.fromEntries(
			[5, 4, 3, 2, 1].map((number) => [
				`black-${number}`,
				{
					id: `black-${number}`,
					color: 'black' as const,
					number: number as 1 | 2 | 3 | 4 | 5,
				},
			]),
		);
		replaceGameData(
			playingData({
				clues: 7,
				tiles: blackTiles,
				playedTiles: ['black-5', 'black-4', 'black-3', 'black-2'],
				playerTiles: { alice: ['black-1'], bob: [] },
			}),
		);

		sockets.emit('alice', { scope, type: 'PlayTileMessage', data: { id: 'black-1' } });

		const data = serializedData(game);
		expect(data.playedTiles).toEqual(['black-5', 'black-4', 'black-3', 'black-2', 'black-1']);
		expect(data.clues).toBe(8);
	});

	it('wins only after all five colored fireworks and the black firework are complete', () => {
		const scope = getScope(game.title, game.id);
		const tiles: Record<string, HanabiTile> = {};
		const playedTiles: string[] = [];

		for (const color of ['red', 'blue', 'green', 'yellow', 'white'] as const) {
			for (const number of [1, 2, 3, 4, 5] as const) {
				const id = `${color}-${number}`;
				tiles[id] = { id, color, number };
				playedTiles.push(id);
			}
		}
		for (const number of [5, 4, 3, 2, 1] as const) {
			const id = `black-${number}`;
			tiles[id] = { id, color: 'black', number };
			if (number !== 1) {
				playedTiles.push(id);
			}
		}

		replaceGameData(
			playingData({
				tiles,
				playedTiles,
				playerTiles: { alice: ['black-1'], bob: [] },
			}),
		);

		sockets.emit('alice', { scope, type: 'PlayTileMessage', data: { id: 'black-1' } });

		const data = serializedData(game);
		expect(data.playedTiles).toHaveLength(30);
		expect(data.stage).toBe(HanabiStage.Finished);
		expect(data.finishedReason).toBe('Won');
	});

	it('includes black tiles in rank clues but excludes them from color clues', () => {
		const scope = getScope(game.title, game.id);
		const tiles: Record<string, HanabiTile> = {
			'red-3': { id: 'red-3', color: 'red', number: 3 },
			'black-3': { id: 'black-3', color: 'black', number: 3 },
			'blue-2': { id: 'blue-2', color: 'blue', number: 2 },
		};
		const data = playingData({
			tiles,
			playerTiles: { alice: [], bob: ['red-3', 'black-3', 'blue-2'] },
		});
		replaceGameData(data);

		sockets.emit('alice', {
			scope,
			type: 'GiveClueMessage',
			data: { to: 'bob', number: 3 },
		});

		expect(serializedData(game).actions.at(-1)).toMatchObject({
			type: 'GiveNumberClue',
			tiles: [tiles['red-3'], tiles['black-3']],
		});

		replaceGameData(data);
		sockets.emit('alice', {
			scope,
			type: 'GiveClueMessage',
			data: { to: 'bob', color: 'red' },
		});
		expect(serializedData(game).actions.at(-1)).toMatchObject({
			type: 'GiveColorClue',
			tiles: [tiles['red-3']],
		});

		replaceGameData(data);
		sockets.emit('alice', {
			scope,
			type: 'GiveClueMessage',
			data: { to: 'bob', color: 'black' },
		} as unknown as HanabiMessage);
		expect(sockets.sent.at(-1)?.message).toMatchObject({
			type: 'GiveClueResponseMessage',
			data: { error: 'Invalid clue.' },
		});
	});

	it('applies rainbow color decoys without making black tiles clueable in the combined mode', () => {
		const scope = getScope(game.title, game.id);
		const tiles: Record<string, HanabiTile> = {
			'red-3': { id: 'red-3', color: 'red', number: 3 },
			'rainbow-2': { id: 'rainbow-2', color: 'rainbow', number: 2 },
			'black-3': { id: 'black-3', color: 'black', number: 3 },
		};
		replaceGameData(
			playingData({
				ruleSet: 'rainbow-black-powder',
				tiles,
				playerTiles: { alice: [], bob: ['red-3', 'rainbow-2', 'black-3'] },
			}),
		);

		sockets.emit('alice', {
			scope,
			type: 'GiveClueMessage',
			data: { to: 'bob', color: 'red' },
		});

		expect(serializedData(game).actions.at(-1)).toMatchObject({
			type: 'GiveColorClue',
			tiles: [tiles['red-3'], tiles['rainbow-2']],
		});
	});

	it('accepts purple clues only in the six-color rule set', () => {
		const scope = getScope(game.title, game.id);
		const purple: HanabiTile = { id: 'purple-2', color: 'purple', number: 2 };
		replaceGameData(
			playingData({
				ruleSet: '6-color',
				tiles: { [purple.id]: purple },
				playerTiles: { alice: [], bob: [purple.id] },
			}),
		);

		sockets.emit('alice', {
			scope,
			type: 'GiveClueMessage',
			data: { to: 'bob', color: 'purple' },
		});

		expect(serializedData(game).actions.at(-1)).toMatchObject({
			type: 'GiveColorClue',
			color: 'purple',
			tiles: [purple],
		});
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
			data: { to: clueRecipientId, number: clueTile.number },
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
