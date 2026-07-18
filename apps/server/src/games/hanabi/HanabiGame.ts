import {
	getNewPositionsForTiles,
	addToTileNotes,
	getHanabiCompletionTileCount,
	getHanabiFireworkSequence,
	generateHanabiGameData,
	generatePlayer,
	generateRandomDeck,
	HANABI_CLUE_COLORS,
	isHanabiFireworkCompletion,
	isHanabiRainbowRuleSet,
	isHanabiRuleSet,
	HANABI_BOARD_SIZE,
	HANABI_DEFAULT_TILE_POSITIONS,
	HANABI_GAME_TITLE,
	HANABI_MAX_ACTIONS,
	HANABI_MAX_CHAT_LENGTH,
	HANABI_MAX_CLUES,
	HANABI_MAX_PLAYERS,
	HANABI_MIN_PLAYERS,
	HANABI_TILE_SIZE,
	HANABI_TILES_IN_HAND,
	HanabiFinishedReason,
	HanabiGameAction,
	HanabiClueColor,
	HanabiGameActionType,
	HanabiGameData,
	HanabiStage,
	HanabiTile,
	Position,
	AddPlayerMessage,
	ChangeGameSettingsMessage,
	CreateDebugPlayerMessage,
	DebugPlayerAction,
	DebugPlayerActionMessage,
	DiscardTileMessage,
	getScope,
	GiveClueMessage,
	HanabiMessage,
	MoveTilesMessage,
	PlayTileMessage,
	RemovePlayerMessage,
	ResetGameMessage,
	SendChatMessage,
	StartGameMessage,
	shuffle,
} from '@hanabi/shared';
import Game, { GameSerialized } from '../server/Game.js';
import GameMessenger from '../server/GameMessenger.js';
import { SaveGameDelegate } from '../server/GameStore.js';
import UserConnectionListener, { UserConnectionChange } from '../server/UserConnectionListener.js';
import ServerSocketManager from '../../utils/SocketManager.js';
import { randomUUID } from 'node:crypto';

export interface HanabiGameSerialized extends GameSerialized {
	data: HanabiGameData;
}

const INVALID_MESSAGE_PAYLOAD = 'Invalid message payload.';
const READ_ACTIVITY_SAVE_INTERVAL_MS = 60_000;
type ActionResponseDelegate = (data: { error?: string }) => void;

const DEBUG_PLAYER_NAME = 'Debug Player';

export default class HanabiGame extends Game {
	get title(): string {
		return HANABI_GAME_TITLE;
	}

	private _gameData: HanabiGameData = generateHanabiGameData();

	private _messenger: GameMessenger<HanabiMessage>;
	private _userConnectionListener: UserConnectionListener;
	private _lastReadActivitySaveAt = 0;
	private readonly _debugPlayerControls: boolean;

	constructor(
		creatorIdOrData: string | HanabiGameSerialized,
		socketManager: ServerSocketManager,
		saveGameDelegate: SaveGameDelegate,
		private readonly _minimumPlayers = HANABI_MIN_PLAYERS,
		debugPlayerControls = false,
	) {
		super(
			typeof creatorIdOrData === 'string' ? creatorIdOrData : creatorIdOrData.creatorId,
			saveGameDelegate,
		);
		this._debugPlayerControls = debugPlayerControls;

		if (typeof creatorIdOrData === 'string') {
			this._gameData = generateHanabiGameData({ creatorId: creatorIdOrData });
		} else {
			this._id = creatorIdOrData.id;
			this._code = creatorIdOrData.code;
			this._creatorId = creatorIdOrData.creatorId;
			this._created = new Date(creatorIdOrData.created);
			this._updated = new Date(creatorIdOrData.updated);
			this._gameData = {
				...creatorIdOrData.data,
				creatorId: creatorIdOrData.creatorId,
				players: Object.fromEntries(
					Object.entries(creatorIdOrData.data.players).map(([id, player]) => [
						id,
						{ ...player, connected: false },
					]),
				),
			};
		}

		this._messenger = new GameMessenger(socketManager, getScope(HANABI_GAME_TITLE, this.id));
		this._messenger.connect(this._handleMessage);

		this._userConnectionListener = new UserConnectionListener(socketManager);
		this._userConnectionListener.start(this._handleUserConnectionChange);
	}

	public cleanUp(): void {
		this._messenger.disconnect();
		this._userConnectionListener.stop();
	}

	public serialize(): string | null {
		const baseSerialized = this._getBaseData();
		const serialized: HanabiGameSerialized = {
			...baseSerialized,
			data: this._gameData,
		};
		return JSON.stringify(serialized);
	}

	private _getAllPlayerAndWatcherIds(): string[] {
		return [...new Set([...this.watchers, ...Object.keys(this._gameData.players)])];
	}

	private _isRecord(value: unknown): value is Record<string, unknown> {
		return typeof value === 'object' && value !== null && !Array.isArray(value);
	}

	private _messagePayloadIsValid(message: HanabiMessage): boolean {
		const data: unknown = message.data;
		switch (message.type) {
			case 'GetGameDataMessage':
			case 'StartGameMessage':
			case 'ResetGameMessage':
				return data === undefined;
			case 'AddPlayerMessage':
				return this._isRecord(data) && typeof data.name === 'string';
			case 'RemovePlayerMessage':
				return (
					this._isRecord(data) && (data.playerId === undefined || typeof data.playerId === 'string')
				);
			case 'ChangeGameSettingsMessage':
				return (
					this._isRecord(data) &&
					Object.keys(data).every((key) =>
						['ruleSet', 'allowDragging', 'showNotes', 'criticalGameOver'].includes(key),
					) &&
					(data.ruleSet === undefined || isHanabiRuleSet(data.ruleSet)) &&
					(data.allowDragging === undefined || typeof data.allowDragging === 'boolean') &&
					(data.showNotes === undefined || typeof data.showNotes === 'boolean') &&
					(data.criticalGameOver === undefined || typeof data.criticalGameOver === 'boolean')
				);
			case 'SendChatMessage':
				return typeof data === 'string';
			case 'PlayTileMessage':
			case 'DiscardTileMessage':
				return this._isRecord(data) && typeof data.id === 'string';
			case 'GiveClueMessage':
				return (
					this._isRecord(data) &&
					typeof data.to === 'string' &&
					(data.color === undefined || typeof data.color === 'string') &&
					(data.number === undefined || typeof data.number === 'number')
				);
			case 'MoveTilesMessage':
				return this._isRecord(data);
			default:
				return true;
		}
	}

	private _sendInvalidPayloadResponse(userId: string, message: HanabiMessage): void {
		const data = { error: INVALID_MESSAGE_PAYLOAD };
		switch (message.type) {
			case 'GetGameDataMessage':
				this._sendGameData(userId);
				break;
			case 'AddPlayerMessage':
				this._messenger.send(userId, { type: 'AddPlayerResponseMessage', data });
				break;
			case 'RemovePlayerMessage':
				this._messenger.send(userId, { type: 'RemovePlayerResponseMessage', data });
				break;
			case 'ChangeGameSettingsMessage':
				this._messenger.send(userId, { type: 'ChangeGameSettingsResponseMessage', data });
				break;
			case 'SendChatMessage':
				this._messenger.send(userId, { type: 'SendChatResponseMessage', data });
				break;
			case 'StartGameMessage':
				this._messenger.send(userId, { type: 'StartGameResponseMessage', data });
				break;
			case 'ResetGameMessage':
				this._messenger.send(userId, { type: 'ResetGameResponseMessage', data });
				break;
			case 'PlayTileMessage':
				this._messenger.send(userId, { type: 'PlayTileResponseMessage', data });
				break;
			case 'DiscardTileMessage':
				this._messenger.send(userId, { type: 'DiscardTileResponseMessage', data });
				break;
			case 'GiveClueMessage':
				this._messenger.send(userId, { type: 'GiveClueResponseMessage', data });
				break;
			case 'MoveTilesMessage':
				this._messenger.send(userId, { type: 'MoveTilesResponseMessage', data });
				break;
		}
	}

	private _gameDataForRecipient(userId: string): HanabiGameData {
		if (this._gameData.stage === HanabiStage.Finished) {
			return this._gameData;
		}

		const concealedTileIds = new Set(this._gameData.remainingTiles);
		for (const tileId of this._gameData.playerTiles[userId] ?? []) {
			concealedTileIds.add(tileId);
		}
		const tiles = { ...this._gameData.tiles };
		for (const tileId of concealedTileIds) {
			if (tiles[tileId]) {
				tiles[tileId] = { id: tileId, color: 'white', number: 1, concealed: true };
			}
		}
		const actions = this._gameData.actions.map((action) => {
			if (
				action.type !== HanabiGameActionType.GiveColorClue &&
				action.type !== HanabiGameActionType.GiveNumberClue
			) {
				return action;
			}
			return {
				...action,
				tiles: action.tiles.map(({ id }) => ({
					id,
					color: 'white' as const,
					number: 1 as const,
					concealed: true as const,
				})),
			};
		});

		return { ...this._gameData, seed: '', tiles, actions };
	}

	private _broadcastGameData(additionalUserIds: readonly string[] = []): void {
		for (const userId of new Set([...additionalUserIds, ...this._getAllPlayerAndWatcherIds()])) {
			this._messenger.send(userId, {
				type: 'RefreshGameDataMessage',
				data: this._gameDataForRecipient(userId),
			});
		}
	}

	private _appendActions(...actions: HanabiGameAction[]): void {
		this._gameData.actions = [...this._gameData.actions, ...actions].slice(-HANABI_MAX_ACTIONS);
	}

	private _handleMessage = ({
		userId,
		message,
	}: {
		userId: string;
		message: HanabiMessage;
	}): void => {
		if (!this._messagePayloadIsValid(message)) {
			this._sendInvalidPayloadResponse(userId, message);
			return;
		}

		switch (message.type) {
			case 'GetGameDataMessage':
				this._sendGameData(userId);
				break;
			case 'AddPlayerMessage':
				this._handleAddPlayerMessage(message, userId);
				break;
			case 'RemovePlayerMessage':
				this._handleRemovePlayerMessage(message, userId);
				break;
			case 'CreateDebugPlayerMessage':
				this._handleCreateDebugPlayerMessage(message, userId);
				break;
			case 'DebugPlayerActionMessage':
				this._handleDebugPlayerActionMessage(message, userId);
				break;
			case 'ChangeGameSettingsMessage':
				this._handleChangeGameSettingsMessage(message, userId);
				break;
			case 'SendChatMessage':
				this._handleSendChatMessage(message, userId);
				break;
			case 'StartGameMessage':
				this._handleStartGameMessage(message, userId);
				break;
			case 'PlayTileMessage':
				this._handlePlayTileMessage(message, userId);
				break;
			case 'DiscardTileMessage':
				this._handleDiscardTileMessage(message, userId);
				break;
			case 'GiveClueMessage':
				this._handleGiveClueMessage(message, userId);
				break;
			case 'MoveTilesMessage':
				this._handleMoveTilesMessage(message, userId);
				break;
			case 'ResetGameMessage':
				this._handleResetGameMessage(message, userId);
				break;
		}
	};

	private _handleUserConnectionChange = (userId: string, change: UserConnectionChange) => {
		if (!this._gameData.players[userId]) {
			return;
		}

		this._gameData.players[userId].connected = change === UserConnectionChange.Authenticated;

		this._broadcastGameData();

		// Touch the games last updated time.
		this._update();
	};

	private _sendGameData(playerId: string): void {
		this._messenger.send(playerId, {
			type: 'RefreshGameDataMessage',
			data: this._gameDataForRecipient(playerId),
		});

		// Reads keep active games from being pruned, but persist that access at most
		// once per minute so refresh storms cannot saturate the backing store.
		const now = Date.now();
		this._updated = new Date(now);
		if (now - this._lastReadActivitySaveAt >= READ_ACTIVITY_SAVE_INTERVAL_MS) {
			this._lastReadActivitySaveAt = now;
			this._update();
		}
	}

	private _handleAddPlayerMessage({ data: { name } }: AddPlayerMessage, playerId: string): void {
		// Error if already started.
		if (this._gameData.stage !== HanabiStage.Setup) {
			this._messenger.send(playerId, {
				type: 'AddPlayerResponseMessage',
				data: {
					error: 'Cannot join game because it has already started.',
				},
			});
			return;
		}
		const trimmedName = typeof name === 'string' ? name.trim() : '';
		if (!trimmedName || trimmedName.length > 40) {
			this._messenger.send(playerId, {
				type: 'AddPlayerResponseMessage',
				data: { error: 'Names must be between 1 and 40 characters.' },
			});
			return;
		}
		if (
			!this._gameData.players[playerId] &&
			Object.keys(this._gameData.players).length >= HANABI_MAX_PLAYERS
		) {
			this._messenger.send(playerId, {
				type: 'AddPlayerResponseMessage',
				data: { error: `Hanabi supports at most ${HANABI_MAX_PLAYERS} players.` },
			});
			return;
		}

		// Add the player to the player list.
		this._addPlayer(playerId, trimmedName);

		// Success! Respond to the creator.
		this._messenger.send(playerId, {
			type: 'AddPlayerResponseMessage',
			data: {},
		});

		// Send the updated state to all players/watchers.
		this._broadcastGameData();

		// Touch the games last updated time.
		this._update();
	}

	private _addPlayer(playerId: string, name: string): void {
		const player = generatePlayer({ id: playerId, name });
		this._gameData.players = { ...this._gameData.players, [playerId]: player };
	}

	private _debugPlayerId(): string {
		return `debug:${this.creatorId}`;
	}

	private _handleCreateDebugPlayerMessage(
		_message: CreateDebugPlayerMessage,
		userId: string,
	): void {
		const respond = (data: { playerId?: string; error?: string }) => {
			this._messenger.send(userId, { type: 'CreateDebugPlayerResponseMessage', data });
		};

		if (!this._debugPlayerControls) {
			respond({ error: 'Debug player controls are disabled.' });
			return;
		}
		if (userId !== this.creatorId || !this._gameData.players[userId]) {
			respond({ error: 'Only the joined host can create a debug player.' });
			return;
		}
		if (this._gameData.stage !== HanabiStage.Setup) {
			respond({ error: 'Cannot add a debug player after the game has started.' });
			return;
		}

		const debugPlayerId = this._debugPlayerId();
		if (!this._gameData.players[debugPlayerId]) {
			if (Object.keys(this._gameData.players).length >= HANABI_MAX_PLAYERS) {
				respond({ error: `Hanabi supports at most ${HANABI_MAX_PLAYERS} players.` });
				return;
			}
			this._addPlayer(debugPlayerId, DEBUG_PLAYER_NAME);
		}

		respond({ playerId: debugPlayerId });
		this._messenger.send(this._getAllPlayerAndWatcherIds(), {
			type: 'RefreshGameDataMessage',
			data: this._gameData,
		});
		this._update();
	}

	private _isDebugPlayerAction(value: unknown): value is DebugPlayerAction {
		if (!value || typeof value !== 'object') {
			return false;
		}

		const action = value as Record<string, unknown>;
		if (action.type === 'play' || action.type === 'discard') {
			return typeof action.tileId === 'string';
		}
		if (action.type !== 'clue' || typeof action.to !== 'string') {
			return false;
		}

		const numbers = [1, 2, 3, 4, 5];
		const hasColor = action.color !== undefined;
		const hasNumber = action.number !== undefined;
		return (
			hasColor !== hasNumber &&
			(!hasColor || HANABI_CLUE_COLORS.includes(action.color as HanabiClueColor)) &&
			(!hasNumber || numbers.includes(action.number as number))
		);
	}

	private _handleDebugPlayerActionMessage(message: DebugPlayerActionMessage, userId: string): void {
		const respond: ActionResponseDelegate = (data) => {
			this._messenger.send(userId, { type: 'DebugPlayerActionResponseMessage', data });
		};

		if (!this._debugPlayerControls) {
			respond({ error: 'Debug player controls are disabled.' });
			return;
		}
		if (userId !== this.creatorId || !this._gameData.players[userId]) {
			respond({ error: 'Only the joined host can control the debug player.' });
			return;
		}

		const debugPlayerId = this._debugPlayerId();
		if (!this._gameData.players[debugPlayerId]) {
			respond({ error: 'Debug player has not been created.' });
			return;
		}

		const data = message.data as unknown;
		const action =
			data && typeof data === 'object' ? (data as { action?: unknown }).action : undefined;
		if (!this._isDebugPlayerAction(action)) {
			respond({ error: 'Invalid debug player action.' });
			return;
		}

		switch (action.type) {
			case 'play':
				this._handlePlayTileMessage(
					{ ...message, type: 'PlayTileMessage', data: { id: action.tileId } },
					debugPlayerId,
					respond,
				);
				break;
			case 'discard':
				this._handleDiscardTileMessage(
					{ ...message, type: 'DiscardTileMessage', data: { id: action.tileId } },
					debugPlayerId,
					respond,
				);
				break;
			case 'clue':
				this._handleGiveClueMessage(
					{
						...message,
						type: 'GiveClueMessage',
						data: { to: action.to, color: action.color, number: action.number },
					},
					debugPlayerId,
					respond,
				);
				break;
		}
	}

	private _handleRemovePlayerMessage(
		{ data: { playerId } }: RemovePlayerMessage,
		userId: string,
	): void {
		const removeUserId = playerId || userId;

		// Error if already started.
		if (this._gameData.stage !== HanabiStage.Setup) {
			this._messenger.send(userId, {
				type: 'RemovePlayerResponseMessage',
				data: {
					error: 'Cannot remove user from game because it has already started.',
				},
			});
			return;
		}
		if (removeUserId !== userId && this.creatorId !== userId) {
			this._messenger.send(userId, {
				type: 'RemovePlayerResponseMessage',
				data: { error: 'Only the host can remove another player.' },
			});
			return;
		}

		const { [removeUserId]: _removedPlayer, ...remainingPlayers } = this._gameData.players;
		this._gameData.players = remainingPlayers;

		this._messenger.send(userId, {
			type: 'RemovePlayerResponseMessage',
			data: {},
		});

		// Send the updated state to all players/watchers.
		this._broadcastGameData([userId]);

		// Touch the games last updated time.
		this._update();
	}

	private _handleChangeGameSettingsMessage(
		message: ChangeGameSettingsMessage,
		userId: string,
	): void {
		// Basic validation:
		if (this._gameData.stage !== HanabiStage.Setup) {
			this._messenger.send(userId, {
				type: 'ChangeGameSettingsResponseMessage',
				data: {
					error: 'Cannot change game settings after it has started.',
				},
			});
			return;
		}

		if (!this._gameData.players[userId]) {
			this._messenger.send(userId, {
				type: 'ChangeGameSettingsResponseMessage',
				data: {
					error: 'Only players can change game settings.',
				},
			});
			return;
		}

		// Settings specific validation:
		if (message.data.ruleSet) {
			if (!isHanabiRuleSet(message.data.ruleSet)) {
				this._messenger.send(userId, {
					type: 'ChangeGameSettingsResponseMessage',
					data: {
						error: 'Invalid rules set.',
					},
				});
				return;
			}

			this._gameData.ruleSet = message.data.ruleSet;
		}

		if (message.data.allowDragging !== undefined) {
			this._gameData.allowDragging = message.data.allowDragging;
		}

		if (message.data.showNotes !== undefined) {
			this._gameData.showNotes = message.data.showNotes;
		}

		if (message.data.criticalGameOver !== undefined) {
			this._gameData.criticalGameOver = message.data.criticalGameOver;
		}

		// Success!
		this._messenger.send(userId, {
			type: 'ChangeGameSettingsResponseMessage',
			data: {},
		});

		// Send the updated state to all players/watchers.
		this._broadcastGameData();

		// Touch the games last updated time.
		this._update();
	}

	private _handleSendChatMessage(message: SendChatMessage, userId: string): void {
		const chat = typeof message.data === 'string' ? message.data.trim() : '';
		if (!this._gameData.players[userId] || !chat || chat.length > HANABI_MAX_CHAT_LENGTH) {
			this._messenger.send(userId, {
				type: 'SendChatResponseMessage',
				data: {
					error: `Chat messages must be between 1 and ${HANABI_MAX_CHAT_LENGTH} characters.`,
				},
			});
			return;
		}

		// Add the chat action.
		this._appendActions({
			id: randomUUID(),
			type: HanabiGameActionType.Chat,
			playerId: userId,
			message: chat,
		});

		// Success!
		this._messenger.send(userId, {
			type: 'SendChatResponseMessage',
			data: {},
		});

		// Send the updated state to all players/watchers.
		this._broadcastGameData();

		// Touch the games last updated time.
		this._update();
	}

	private _handleStartGameMessage(_message: StartGameMessage, userId: string): void {
		// Validate that the game is ready.
		if (this._gameData.stage !== HanabiStage.Setup) {
			this._messenger.send(userId, {
				type: 'StartGameResponseMessage',
				data: {
					error: 'Cannot start game because it has already started.',
				},
			});
			return;
		}

		const playerCount = Object.keys(this._gameData.players).length;
		if (playerCount < this._minimumPlayers) {
			this._messenger.send(userId, {
				type: 'StartGameResponseMessage',
				data: {
					error: 'Not enough players to play.',
				},
			});
			return;
		}
		if (playerCount > HANABI_MAX_PLAYERS) {
			this._messenger.send(userId, {
				type: 'StartGameResponseMessage',
				data: { error: `Hanabi supports at most ${HANABI_MAX_PLAYERS} players.` },
			});
			return;
		}

		if (!this._gameData.players[userId]) {
			this._messenger.send(userId, {
				type: 'StartGameResponseMessage',
				data: {
					error: 'Only players can start the game.',
				},
			});
			return;
		}

		// Start the game!
		this._gameData.stage = HanabiStage.Playing;

		// Generate a fresh deck and randomize the tiles.
		const players = Object.values(this._gameData.players);
		const [tiles, remainingTiles] = generateRandomDeck(this._gameData.ruleSet, this._gameData.seed);
		const tilesInHand = HANABI_TILES_IN_HAND[players.length];

		const newPlayerTiles: { [playerId: string]: string[] } = {};
		const newPositions: { [tileId: string]: Position } = {};

		for (const player of players) {
			newPlayerTiles[player.id] = [];

			for (let i = 0; i < tilesInHand; i += 1) {
				const tileId = remainingTiles.pop()!;
				newPlayerTiles[player.id].push(tileId);
				newPositions[tileId] = { ...HANABI_DEFAULT_TILE_POSITIONS[i] };
			}
		}

		this._gameData.playerTiles = { ...this._gameData.playerTiles, ...newPlayerTiles };
		this._gameData.tilePositions = { ...this._gameData.tilePositions, ...newPositions };

		this._gameData.tiles = tiles;
		this._gameData.remainingTiles = remainingTiles;

		// Set up turn order.
		this._gameData.turnOrder = shuffle(players.map((player) => player.id));
		this._gameData.currentPlayerId = this._gameData.turnOrder[0];

		// Record the action.
		this._appendActions({
			id: randomUUID(),
			type: HanabiGameActionType.GameStarted,
			startingPlayerId: this._gameData.currentPlayerId,
		});

		// Send success message.
		this._messenger.send(userId, {
			type: 'StartGameResponseMessage',
			data: {},
		});

		// Send the updated state to all players/watchers.
		this._broadcastGameData();

		// Touch the games last updated time.
		this._update();
	}

	private _validateGameAction(userId: string): string | null {
		if (!this._gameData.players[userId]) {
			return 'Invalid player!';
		}

		if (this._gameData.stage !== HanabiStage.Playing) {
			return "The game isn't being played right now.";
		}

		if (this._gameData.currentPlayerId !== userId) {
			return "It's not your turn!";
		}

		return null;
	}

	private _discardedTileIsFatal(tile: HanabiTile): boolean {
		const { tiles } = this._gameData;

		// Check if the tile has already been played.
		if (
			this._gameData.playedTiles.find(
				(tid: string) => tiles[tid].color === tile.color && tiles[tid].number === tile.number,
			)
		) {
			return false;
		}

		// Check remaining tiles for a copy.
		if (
			this._gameData.remainingTiles.find(
				(tid: string) => tiles[tid].color === tile.color && tiles[tid].number === tile.number,
			)
		) {
			return false;
		}

		// Check players' hands for a copy.
		for (const playerTiles of Object.values(this._gameData.playerTiles)) {
			for (const tid of playerTiles) {
				if (tiles[tid].color === tile.color && tiles[tid].number === tile.number) {
					return false;
				}
			}
		}

		// No copy left in play. Game is failed.
		return true;
	}

	private _pickUpNextTile(userId: string): void {
		if (this._gameData.remainingTiles.length === 0) {
			throw new Error('No tiles left to pick up!');
		}

		const newTileId = this._gameData.remainingTiles[this._gameData.remainingTiles.length - 1];
		this._gameData.remainingTiles = this._gameData.remainingTiles.slice(0, -1);
		const newPosition = { x: Number.MAX_SAFE_INTEGER, y: 0, z: 0 };

		const tilePositions: { [tileId: string]: Position } = {};
		for (const tileId of this._gameData.playerTiles[userId]) {
			tilePositions[tileId] = this._gameData.tilePositions[tileId];
		}

		const newTilePositions = getNewPositionsForTiles(
			{ [newTileId]: newPosition },
			tilePositions,
			true,
		);

		this._gameData.tilePositions = { ...this._gameData.tilePositions, ...newTilePositions };

		this._gameData.playerTiles[userId].push(newTileId);
	}

	private _getNextUserId(turnOrder: readonly string[], currentUser: string | null): string | null {
		if (currentUser === null) {
			return null;
		}

		const currentIndex = turnOrder.indexOf(currentUser);

		if (currentIndex === -1) {
			return null;
		}

		const nextIndex = (currentIndex + 1) % turnOrder.length;
		return turnOrder[nextIndex];
	}

	private _completeTurn(
		userId: string,
		options: { startShotClockIfDeckEmpty?: boolean; gameWon?: boolean } = {},
	): void {
		if (
			this._gameData.remainingTurns === null &&
			options.startShotClockIfDeckEmpty &&
			this._gameData.remainingTiles.length === 0
		) {
			this._gameData.remainingTurns = Object.keys(this._gameData.players).length;
			this._appendActions({
				id: randomUUID(),
				playerId: userId,
				type: HanabiGameActionType.ShotClockStarted,
				remainingTurns: this._gameData.remainingTurns,
			});
		} else if (this._gameData.remainingTurns !== null) {
			this._gameData.remainingTurns -= 1;
			if (this._gameData.remainingTurns === 0) {
				this._gameData.stage = HanabiStage.Finished;
				this._gameData.finishedReason = HanabiFinishedReason.OutOfTurns;
			} else {
				this._appendActions({
					id: randomUUID(),
					playerId: userId,
					type: HanabiGameActionType.ShotClockTickedDown,
					remainingTurns: this._gameData.remainingTurns,
				});
			}
		}

		if (options.gameWon) {
			this._gameData.stage = HanabiStage.Finished;
			this._gameData.finishedReason = HanabiFinishedReason.Won;
		}

		this._gameData.currentPlayerId = this._getNextUserId(
			this._gameData.turnOrder,
			this._gameData.currentPlayerId,
		);
		if (this._gameData.finishedReason !== null) {
			this._appendActions({
				id: randomUUID(),
				type: HanabiGameActionType.GameFinished,
				finishedReason: this._gameData.finishedReason,
			});
		}
	}

	private _handlePlayTileMessage(
		message: PlayTileMessage,
		userId: string,
		respond: ActionResponseDelegate = (data) =>
			this._messenger.send(userId, { type: 'PlayTileResponseMessage', data }),
	): void {
		const { tiles } = this._gameData;

		const gameActionError = this._validateGameAction(userId);
		if (gameActionError) {
			respond({ error: gameActionError });
			return;
		}

		const tile = this._gameData.tiles[message.data.id];

		if (!tile || !this._gameData.playerTiles[userId].includes(tile.id)) {
			respond({ error: "That tile isn't in your hand!" });
			return;
		}

		// Remove the tile from the player.
		const newPlayerTiles = this._gameData.playerTiles[userId].filter(
			(tid: string) => tid !== tile.id,
		);
		this._gameData.playerTiles = { ...this._gameData.playerTiles, [userId]: newPlayerTiles };

		// Pick up another tile if available.
		if (this._gameData.remainingTiles.length) {
			this._pickUpNextTile(userId);
		}

		// Check if the tile is valid. If so, play it.
		const duplicate = !!this._gameData.playedTiles.find(
			(tid: string) => tiles[tid].color === tile.color && tiles[tid].number === tile.number,
		);
		const fireworkSequence = getHanabiFireworkSequence(tile.color);
		const tileSequenceIndex = fireworkSequence.indexOf(tile.number);
		const previousNumberInSequence = fireworkSequence[tileSequenceIndex - 1];
		const prevNumberInSequenceExists = !!(
			tileSequenceIndex === 0 ||
			this._gameData.playedTiles.find(
				(tid: string) =>
					tiles[tid].color === tile.color && tiles[tid].number === previousNumberInSequence,
			)
		);

		const tileIsValid = !duplicate && prevNumberInSequenceExists;

		if (tileIsValid) {
			this._gameData.playedTiles = [...this._gameData.playedTiles, tile.id];

			if (isHanabiFireworkCompletion(tile) && this._gameData.clues !== HANABI_MAX_CLUES) {
				this._gameData.clues += 1;
			}
		} else {
			this._gameData.lives -= 1;

			if (this._gameData.lives === 0) {
				this._gameData.stage = HanabiStage.Finished;
				this._gameData.finishedReason = HanabiFinishedReason.OutOfLives;
			}

			this._gameData.discardedTiles = [...this._gameData.discardedTiles, tile.id];
		}

		// Remove the tile position.
		const newPositions = { ...this._gameData.tilePositions };
		delete newPositions[tile.id];
		this._gameData.tilePositions = newPositions;

		// Detect if the game is over due to the wrong tile being discarded.
		if (this._gameData.criticalGameOver && !tileIsValid && this._discardedTileIsFatal(tile)) {
			this._gameData.stage = HanabiStage.Finished;
			this._gameData.finishedReason = HanabiFinishedReason.DiscardedFatalTile;
		}

		// Record the action.
		this._appendActions({
			id: randomUUID(),
			playerId: userId,
			type: HanabiGameActionType.Play,
			tile,
			valid: tileIsValid,
			remainingLives: this._gameData.lives,
		});

		const maxPlayedTiles = getHanabiCompletionTileCount(this._gameData.ruleSet);
		this._completeTurn(userId, {
			startShotClockIfDeckEmpty: true,
			gameWon: this._gameData.playedTiles.length === maxPlayedTiles,
		});

		// Send success message.
		respond({});

		// Send the updated state to all players/watchers.
		this._broadcastGameData();

		// Touch the games last updated time.
		this._update();
	}

	private _handleDiscardTileMessage(
		message: DiscardTileMessage,
		userId: string,
		respond: ActionResponseDelegate = (data) =>
			this._messenger.send(userId, { type: 'DiscardTileResponseMessage', data }),
	): void {
		const gameActionError = this._validateGameAction(userId);
		if (gameActionError) {
			respond({ error: gameActionError });
			return;
		}

		const tile = this._gameData.tiles[message.data.id];

		if (!tile || !this._gameData.playerTiles[userId].includes(tile.id)) {
			respond({ error: "That tile isn't in your hand!" });
			return;
		}

		// Remove the tile from the player.
		const newPlayerTiles = this._gameData.playerTiles[userId].filter(
			(tid: string) => tid !== tile.id,
		);
		this._gameData.playerTiles = { ...this._gameData.playerTiles, [userId]: newPlayerTiles };

		// Add the tile to discarded tiles.
		this._gameData.discardedTiles = [...this._gameData.discardedTiles, tile.id];

		// Pick up another tile if available.
		if (this._gameData.remainingTiles.length) {
			this._pickUpNextTile(userId);
		}

		// Remove the tile position.
		const newPositions = { ...this._gameData.tilePositions };
		delete newPositions[tile.id];
		this._gameData.tilePositions = newPositions;

		// Record the action.
		this._appendActions({
			id: randomUUID(),
			playerId: userId,
			type: HanabiGameActionType.Discard,
			tile,
		});

		// Detect if the game is over due to the wrong tile being discarded.
		if (this._gameData.criticalGameOver && this._discardedTileIsFatal(tile)) {
			this._gameData.stage = HanabiStage.Finished;
			this._gameData.finishedReason = HanabiFinishedReason.DiscardedFatalTile;
		}

		// Add a clue.
		if (this._gameData.clues !== HANABI_MAX_CLUES) {
			this._gameData.clues += 1;
		}

		this._completeTurn(userId, { startShotClockIfDeckEmpty: true });

		// Send success message.
		respond({});

		// Send the updated state to all players/watchers.
		this._broadcastGameData();

		// Touch the games last updated time.
		this._update();
	}

	private _handleGiveClueMessage(
		message: GiveClueMessage,
		userId: string,
		respond: ActionResponseDelegate = (data) =>
			this._messenger.send(userId, { type: 'GiveClueResponseMessage', data }),
	): void {
		const gameActionError = this._validateGameAction(userId);
		if (gameActionError) {
			respond({ error: gameActionError });
			return;
		}

		// Make sure the clue is for a single number or color.
		if (message.data.color !== undefined && message.data.number !== undefined) {
			respond({ error: 'Can only give a clue for a single number or color at a time.' });
			return;
		}
		if (message.data.color === undefined && message.data.number === undefined) {
			respond({ error: 'Clues must contain a number or color.' });
			return;
		}
		if (message.data.to === userId) {
			respond({ error: 'You cannot give yourself a clue.' });
			return;
		}
		const validColorClues: HanabiClueColor[] = ['red', 'yellow', 'green', 'blue', 'white'];
		if (this._gameData.ruleSet === '6-color') {
			validColorClues.push('purple');
		}
		if (
			(message.data.color !== undefined && !validColorClues.includes(message.data.color)) ||
			(message.data.number !== undefined && ![1, 2, 3, 4, 5].includes(message.data.number))
		) {
			respond({ error: 'Invalid clue.' });
			return;
		}

		const recipientTiles = Object.hasOwn(this._gameData.playerTiles, message.data.to)
			? this._gameData.playerTiles[message.data.to]
			: undefined;
		if (!Array.isArray(recipientTiles)) {
			respond({ error: 'Invalid player!' });
			return;
		}

		const selectedTiles = recipientTiles
			.map((tid: string) => this._gameData.tiles[tid])
			.filter((t: HanabiTile) => {
				if (message.data.color) {
					if (isHanabiRainbowRuleSet(this._gameData.ruleSet)) {
						return t.color === message.data.color || t.color === 'rainbow';
					} else {
						return t.color === message.data.color;
					}
				} else {
					return t.number === message.data.number;
				}
			});

		if (selectedTiles.length === 0) {
			respond({ error: 'Clues must select at least 1 tile.' });
			return;
		}

		const actionType =
			message.data.color === undefined
				? HanabiGameActionType.GiveNumberClue
				: HanabiGameActionType.GiveColorClue;

		// Make sure there's a clue to spare.
		if (this._gameData.clues === 0) {
			respond({ error: 'No clues remaining.' });
			return;
		}

		// Decrement clue count.
		this._gameData.clues -= 1;

		// Record the action.
		this._appendActions({
			id: randomUUID(),
			playerId: userId,
			type: actionType,
			recipientId: message.data.to,
			color: message.data.color,
			number: message.data.number,
			tiles: selectedTiles,
		});

		// Record notes for the selected tiles.
		for (const selectedTile of selectedTiles) {
			const newTileNotes = addToTileNotes(
				this._gameData.tileNotes[selectedTile.id],
				message.data.color,
				message.data.number,
			);

			this._gameData.tileNotes = {
				...this._gameData.tileNotes,
				[selectedTile.id]: newTileNotes,
			};
		}

		this._completeTurn(userId);

		// Send success message.
		respond({});

		// Send the updated state to all players/watchers.
		this._broadcastGameData();

		// Touch the games last updated time.
		this._update();
	}

	private _handleMoveTilesMessage(message: MoveTilesMessage, userId: string): void {
		if (!this._gameData.players[userId]) {
			this._messenger.send(userId, {
				type: 'MoveTilesResponseMessage',
				data: { error: 'Invalid player!' },
			});
			return;
		}

		if (this._gameData.stage !== HanabiStage.Playing) {
			this._messenger.send(userId, {
				type: 'MoveTilesResponseMessage',
				data: { error: "The game isn't being played right now.!" },
			});
			return;
		}

		const positions: unknown = message.data;
		if (typeof positions !== 'object' || positions === null || Array.isArray(positions)) {
			this._messenger.send(userId, {
				type: 'MoveTilesResponseMessage',
				data: { error: 'Invalid position.' },
			});
			return;
		}
		const requestedPositions = positions as Record<string, unknown>;

		// Validate that the user owns all these tiles.
		for (const tileId of Object.keys(requestedPositions)) {
			if (!this._gameData.tilePositions[tileId]) {
				this._messenger.send(userId, {
					type: 'MoveTilesResponseMessage',
					data: { error: 'Invalid tile id!' },
				});
				return;
			}

			if (!this._gameData.playerTiles[userId].includes(tileId)) {
				this._messenger.send(userId, {
					type: 'MoveTilesResponseMessage',
					data: { error: "That tile isn't in your hand!" },
				});
				return;
			}

			const position = requestedPositions[tileId];
			const candidate = position as Partial<Position> | null;

			if (
				typeof candidate !== 'object' ||
				candidate === null ||
				typeof candidate.x !== 'number' ||
				typeof candidate.y !== 'number' ||
				typeof candidate.z !== 'number' ||
				!Number.isFinite(candidate.x) ||
				!Number.isFinite(candidate.y) ||
				!Number.isFinite(candidate.z) ||
				candidate.x > HANABI_BOARD_SIZE.width - HANABI_TILE_SIZE.width ||
				candidate.y > HANABI_BOARD_SIZE.height - HANABI_TILE_SIZE.height ||
				candidate.x < 0 ||
				candidate.y < 0
			) {
				this._messenger.send(userId, {
					type: 'MoveTilesResponseMessage',
					data: { error: 'Invalid position.' },
				});
				return;
			}
		}

		// All tiles are validated. We can update positions now.
		this._gameData.tilePositions = {
			...this._gameData.tilePositions,
			...(requestedPositions as Record<string, Position>),
		};

		// Send success message.
		this._messenger.send(userId, {
			type: 'MoveTilesResponseMessage',
			data: {},
		});

		// Send the updated state to all players/watchers.
		this._broadcastGameData();

		// Touch the games last updated time.
		this._update();
	}

	private _handleResetGameMessage(_message: ResetGameMessage, userId: string): void {
		if (!this._gameData.players[userId]) {
			this._messenger.send(userId, {
				type: 'ResetGameResponseMessage',
				data: { error: 'Only players can reset the game.' },
			});
			return;
		}

		// Generate a new game.
		this._gameData = generateHanabiGameData({
			creatorId: this.creatorId,
			players: this._gameData.players,
			ruleSet: this._gameData.ruleSet,
		});

		// Send the updated state to all players/watchers.
		this._messenger.send(userId, {
			type: 'ResetGameResponseMessage',
			data: {},
		});

		// Send the updated state to all players/watchers.
		this._broadcastGameData();

		// Touch the games last updated time.
		this._update();
	}
}
