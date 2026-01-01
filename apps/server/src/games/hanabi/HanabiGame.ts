import {
	getNewPositionsForTiles,
	addToTileNotes,
	generateHanabiGameData,
	generatePlayer,
	generateRandomDeck,
	HANABI_BOARD_SIZE,
	HANABI_DEFAULT_TILE_POSITIONS,
	HANABI_GAME_TITLE,
	HANABI_MAX_CLUES,
	HANABI_MIN_PLAYERS,
	HANABI_TILE_SIZE,
	HANABI_TILES_IN_HAND,
	HanabiFinishedReason,
	HanabiGameActionType,
	HanabiGameData,
	HanabiPlayer,
	HanabiStage,
	HanabiTile,
	Position,
	AddPlayerMessage,
	ChangeGameSettingsMessage,
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
import { v4 as uuidv4 } from 'uuid';
import { env } from '../../env.js';

export interface HanabiGameSerialized extends GameSerialized {
	data: HanabiGameData;
}

export default class HanabiGame extends Game {
	get title(): string {
		return HANABI_GAME_TITLE;
	}

	private _gameData: HanabiGameData = generateHanabiGameData();

	private _messenger: GameMessenger<HanabiMessage>;
	private _userConnectionListener: UserConnectionListener;

	constructor(
		creatorIdOrData: string | HanabiGameSerialized,
		socketManager: ServerSocketManager<HanabiMessage>,
		saveGameDelegate: SaveGameDelegate,
	) {
		super(
			typeof creatorIdOrData === 'string' ? creatorIdOrData : creatorIdOrData.creatorId,
			saveGameDelegate,
		);

		if (typeof creatorIdOrData !== 'string') {
			this._id = creatorIdOrData.id;
			this._code = creatorIdOrData.code;
			this._creatorId = creatorIdOrData.creatorId;
			this._created = new Date(creatorIdOrData.created);
			this._updated = new Date(creatorIdOrData.updated);
			this._gameData = creatorIdOrData.data;
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

	private _handleMessage = ({
		userId,
		message,
	}: {
		userId: string;
		message: HanabiMessage;
	}): void => {
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

		this._messenger.send(this._getAllPlayerAndWatcherIds(), {
			type: 'RefreshGameDataMessage',
			data: this._gameData,
		});

		// Touch the games last updated time.
		this._update();
	};

	private _sendGameData(playerId: string): void {
		this._messenger.send(playerId, {
			type: 'RefreshGameDataMessage',
			data: this._gameData,
		});

		// Touch the games last updated time.
		this._update();
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

		// Add the player to the player list.
		const player = generatePlayer({ id: playerId, name });
		this._gameData.players = { ...this._gameData.players, [playerId]: player };

		// Success! Respond to the creator.
		this._messenger.send(playerId, {
			type: 'AddPlayerResponseMessage',
			data: {},
		});

		// Send the updated state to all players/watchers.
		this._messenger.send(this._getAllPlayerAndWatcherIds(), {
			type: 'RefreshGameDataMessage',
			data: this._gameData,
		});

		// Touch the games last updated time.
		this._update();
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

		const { [removeUserId]: _removedPlayer, ...remainingPlayers } = this._gameData.players;
		this._gameData.players = remainingPlayers;

		this._messenger.send(userId, {
			type: 'RemovePlayerResponseMessage',
			data: {},
		});

		// Send the updated state to all players/watchers.
		this._messenger.send([userId, ...this._getAllPlayerAndWatcherIds()], {
			type: 'RefreshGameDataMessage',
			data: this._gameData,
		});

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
			if (!['5-color', '6-color', 'rainbow'].includes(message.data.ruleSet)) {
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
		this._messenger.send(this._getAllPlayerAndWatcherIds(), {
			type: 'RefreshGameDataMessage',
			data: this._gameData,
		});

		// Touch the games last updated time.
		this._update();
	}

	private _handleSendChatMessage(message: SendChatMessage, userId: string): void {
		// Add the chat action.
		this._gameData.actions = [
			...this._gameData.actions,
			{
				id: uuidv4(),
				type: HanabiGameActionType.Chat,
				playerId: userId,
				message: message.data,
			},
		];

		// Success!
		this._messenger.send(userId, {
			type: 'SendChatResponseMessage',
			data: {},
		});

		// Send the updated state to all players/watchers.
		this._messenger.send(this._getAllPlayerAndWatcherIds(), {
			type: 'RefreshGameDataMessage',
			data: this._gameData,
		});

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

		if (
			Object.keys(this._gameData.players).length <
			(env.NODE_ENV === 'development' ? 1 : HANABI_MIN_PLAYERS)
		) {
			this._messenger.send(userId, {
				type: 'StartGameResponseMessage',
				data: {
					error: 'Not enough players to play.',
				},
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
		const players = Object.values(this._gameData.players) as HanabiPlayer[];
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
		this._gameData.turnOrder = shuffle(players.map((p: HanabiPlayer) => p.id));
		this._gameData.currentPlayerId = this._gameData.turnOrder[0];

		// Record the action.
		this._gameData.actions = [
			...this._gameData.actions,
			{
				id: uuidv4(),
				type: HanabiGameActionType.GameStarted,
				startingPlayerId: this._gameData.currentPlayerId,
			},
		];

		// Send success message.
		this._messenger.send(userId, {
			type: 'StartGameResponseMessage',
			data: {},
		});

		// Send the updated state to all players/watchers.
		this._messenger.send(this._getAllPlayerAndWatcherIds(), {
			type: 'RefreshGameDataMessage',
			data: this._gameData,
		});

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
		for (const playerTiles of Object.values(this._gameData.playerTiles) as string[][]) {
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

	private _handlePlayTileMessage(message: PlayTileMessage, userId: string): void {
		const { tiles } = this._gameData;

		const gameActionError = this._validateGameAction(userId);
		if (gameActionError) {
			this._messenger.send(userId, {
				type: 'PlayTileResponseMessage',
				data: { error: gameActionError },
			});
			return;
		}

		const tile = this._gameData.tiles[message.data.id];

		if (!tile) {
			this._messenger.send(userId, {
				type: 'PlayTileResponseMessage',
				data: { error: "That tile isn't in your hand!" },
			});
			return;
		}

		// Remove the tile from the player.
		const newPlayerTiles = this._gameData.playerTiles[userId].filter((tid: string) => tid !== tile.id);
		this._gameData.playerTiles = { ...this._gameData.playerTiles, [userId]: newPlayerTiles };

		// Pick up another tile if available.
		if (this._gameData.remainingTiles.length) {
			this._pickUpNextTile(userId);
		}

		// Check if the tile is valid. If so, play it.
		const duplicate = !!this._gameData.playedTiles.find(
			(tid: string) => tiles[tid].color === tile.color && tiles[tid].number === tile.number,
		);
		const prevNumberInSequenceExists = !!(
			tile.number === 1 ||
			this._gameData.playedTiles.find(
				(tid: string) => tiles[tid].color === tile.color && tiles[tid].number === tile.number - 1,
			)
		);

		const tileIsValid = !duplicate && prevNumberInSequenceExists;

		if (tileIsValid) {
			this._gameData.playedTiles = [...this._gameData.playedTiles, tile.id];

			if (tile.number === 5 && this._gameData.clues !== HANABI_MAX_CLUES) {
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
		this._gameData.actions = [
			...this._gameData.actions,
			{
				id: uuidv4(),
				playerId: userId,
				type: HanabiGameActionType.Play,
				tile,
				valid: tileIsValid,
				remainingLives: this._gameData.lives,
			},
		];

		// If there's no longer any remaining tiles, start the shot clock.
		if (this._gameData.remainingTurns === null) {
			// Did we run out of tiles?
			if (this._gameData.remainingTiles.length === 0) {
				// Start the shot clock.
				this._gameData.remainingTurns = Object.keys(this._gameData.players).length;

				// Notify the user.
				this._gameData.actions = [
					...this._gameData.actions,
					{
						id: uuidv4(),
						playerId: userId,
						type: HanabiGameActionType.ShotClockStarted,
						remainingTurns: this._gameData.remainingTurns,
					},
				];
			}
		} else {
			// Advance the shot clock.
			this._gameData.remainingTurns -= 1;

			// If it runs out, game over.
			if (this._gameData.remainingTurns === 0) {
				// End the game.
				this._gameData.stage = HanabiStage.Finished;
				this._gameData.finishedReason = HanabiFinishedReason.OutOfTurns;
			} else {
				// Notify the user.
				this._gameData.actions = [
					...this._gameData.actions,
					{
						id: uuidv4(),
						playerId: userId,
						type: HanabiGameActionType.ShotClockTickedDown,
						remainingTurns: this._gameData.remainingTurns,
					},
				];
			}
		}

		// Detect if the game has been won.
		const maxPlayedTiles = this._gameData.ruleSet === '5-color' ? 25 : 30;
		if (this._gameData.playedTiles.length === maxPlayedTiles) {
			this._gameData.stage = HanabiStage.Finished;
			this._gameData.finishedReason = HanabiFinishedReason.Won;
		}

		// If the game is over, notify the user.
		if (this._gameData.finishedReason !== null) {
			this._gameData.actions = [
				...this._gameData.actions,
				{
					id: uuidv4(),
					type: HanabiGameActionType.GameFinished,
					finishedReason: this._gameData.finishedReason,
				},
			];
		}

		// Advance the turn.
		this._gameData.currentPlayerId = this._getNextUserId(
			this._gameData.turnOrder,
			this._gameData.currentPlayerId,
		);

		// Send success message.
		this._messenger.send(userId, {
			type: 'PlayTileResponseMessage',
			data: {},
		});

		// Send the updated state to all players/watchers.
		this._messenger.send(this._getAllPlayerAndWatcherIds(), {
			type: 'RefreshGameDataMessage',
			data: this._gameData,
		});

		// Touch the games last updated time.
		this._update();
	}

	private _handleDiscardTileMessage(message: DiscardTileMessage, userId: string): void {
		const gameActionError = this._validateGameAction(userId);
		if (gameActionError) {
			this._messenger.send(userId, {
				type: 'DiscardTileResponseMessage',
				data: { error: gameActionError },
			});
			return;
		}

		const tile = this._gameData.tiles[message.data.id];

		if (!tile) {
			this._messenger.send(userId, {
				type: 'DiscardTileResponseMessage',
				data: { error: "That tile isn't in your hand!" },
			});
			return;
		}

		// Remove the tile from the player.
		const newPlayerTiles = this._gameData.playerTiles[userId].filter((tid: string) => tid !== tile.id);
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
		this._gameData.actions = [
			...this._gameData.actions,
			{
				id: uuidv4(),
				playerId: userId,
				type: HanabiGameActionType.Discard,
				tile,
			},
		];

		// Detect if the game is over due to the wrong tile being discarded.
		if (this._gameData.criticalGameOver && this._discardedTileIsFatal(tile)) {
			this._gameData.stage = HanabiStage.Finished;
			this._gameData.finishedReason = HanabiFinishedReason.DiscardedFatalTile;
		}

		// If there's no longer any remaining tiles, start the shot clock.
		if (this._gameData.remainingTurns === null) {
			// Did we run out of tiles?
			if (this._gameData.remainingTiles.length === 0) {
				// Start the shot clock.
				this._gameData.remainingTurns = Object.keys(this._gameData.players).length;

				// Notify the user.
				this._gameData.actions = [
					...this._gameData.actions,
					{
						id: uuidv4(),
						playerId: userId,
						type: HanabiGameActionType.ShotClockStarted,
						remainingTurns: this._gameData.remainingTurns,
					},
				];
			}
		} else {
			// Advance the shot clock.
			this._gameData.remainingTurns -= 1;

			// If it runs out, game over.
			if (this._gameData.remainingTurns === 0) {
				this._gameData.stage = HanabiStage.Finished;
				this._gameData.finishedReason = HanabiFinishedReason.OutOfTurns;
			} else {
				// Notify the user.
				this._gameData.actions = [
					...this._gameData.actions,
					{
						id: uuidv4(),
						playerId: userId,
						type: HanabiGameActionType.ShotClockTickedDown,
						remainingTurns: this._gameData.remainingTurns,
					},
				];
			}
		}

		// Add a clue.
		if (this._gameData.clues !== HANABI_MAX_CLUES) {
			this._gameData.clues += 1;
		}

		// Advance the turn.
		this._gameData.currentPlayerId = this._getNextUserId(
			this._gameData.turnOrder,
			this._gameData.currentPlayerId,
		);

		// If the game is over, notify the user.
		if (this._gameData.finishedReason !== null) {
			this._gameData.actions = [
				...this._gameData.actions,
				{
					id: uuidv4(),
					type: HanabiGameActionType.GameFinished,
					finishedReason: this._gameData.finishedReason,
				},
			];
		}

		// Send success message.
		this._messenger.send(userId, {
			type: 'DiscardTileResponseMessage',
			data: {},
		});

		// Send the updated state to all players/watchers.
		this._messenger.send(this._getAllPlayerAndWatcherIds(), {
			type: 'RefreshGameDataMessage',
			data: this._gameData,
		});

		// Touch the games last updated time.
		this._update();
	}

	private _handleGiveClueMessage(message: GiveClueMessage, userId: string): void {
		const gameActionError = this._validateGameAction(userId);
		if (gameActionError) {
			this._messenger.send(userId, {
				type: 'GiveClueResponseMessage',
				data: { error: gameActionError },
			});
			return;
		}

		// Make sure the clue is for a single number or color.
		if (message.data.color !== undefined && message.data.number !== undefined) {
			this._messenger.send(userId, {
				type: 'GiveClueResponseMessage',
				data: { error: 'Can only give a clue for a single number or color at a time.' },
			});
			return;
		}
		if (message.data.color === undefined && message.data.number === undefined) {
			this._messenger.send(userId, {
				type: 'GiveClueResponseMessage',
				data: { error: 'Clues must contain a number or color.' },
			});
			return;
		}

		const recipientTiles = this._gameData.playerTiles[message.data.to];
		if (!recipientTiles) {
			this._messenger.send(userId, {
				type: 'GiveClueResponseMessage',
				data: { error: 'Invalid player!' },
			});
			return;
		}

		const selectedTiles = recipientTiles
			.map((tid: string) => this._gameData.tiles[tid])
			.filter((t: HanabiTile) => {
				if (message.data.color) {
					if (this._gameData.ruleSet === 'rainbow') {
						return t.color === message.data.color || t.color === 'rainbow';
					} else {
						return t.color === message.data.color;
					}
				} else {
					return t.number === message.data.number;
				}
			});

		if (selectedTiles.length === 0) {
			this._messenger.send(userId, {
				type: 'GiveClueResponseMessage',
				data: { error: 'Clues must select at least 1 tile.' },
			});
			return;
		}

		const actionType =
			message.data.color === undefined
				? HanabiGameActionType.GiveNumberClue
				: HanabiGameActionType.GiveColorClue;

		// Make sure there's a clue to spare.
		if (this._gameData.clues === 0) {
			this._messenger.send(userId, {
				type: 'GiveClueResponseMessage',
				data: { error: 'No clues remaining.' },
			});
		}

		// Decrement clue count.
		this._gameData.clues -= 1;

		// Record the action.
		this._gameData.actions = [
			...this._gameData.actions,
			{
				id: uuidv4(),
				playerId: userId,
				type: actionType,
				recipientId: message.data.to,
				color: message.data.color,
				number: message.data.number,
				tiles: selectedTiles,
			},
		];

		// If the shot clock was started, advance it.
		if (this._gameData.remainingTurns !== null) {
			this._gameData.remainingTurns -= 1;

			// If it runs out, game over.
			if (this._gameData.remainingTurns === 0) {
				this._gameData.stage = HanabiStage.Finished;
				this._gameData.finishedReason = HanabiFinishedReason.OutOfTurns;
			} else {
				// Notify the user.
				this._gameData.actions = [
					...this._gameData.actions,
					{
						id: uuidv4(),
						playerId: userId,
						type: HanabiGameActionType.ShotClockTickedDown,
						remainingTurns: this._gameData.remainingTurns,
					},
				];
			}
		}

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

		// Advance the turn.
		this._gameData.currentPlayerId = this._getNextUserId(
			this._gameData.turnOrder,
			this._gameData.currentPlayerId,
		);

		// If the game is over, notify the user.
		if (this._gameData.finishedReason !== null) {
			this._gameData.actions = [
				...this._gameData.actions,
				{
					id: uuidv4(),
					type: HanabiGameActionType.GameFinished,
					finishedReason: this._gameData.finishedReason,
				},
			];
		}

		// Send success message.
		this._messenger.send(userId, {
			type: 'GiveClueResponseMessage',
			data: {},
		});

		// Send the updated state to all players/watchers.
		this._messenger.send(this._getAllPlayerAndWatcherIds(), {
			type: 'RefreshGameDataMessage',
			data: this._gameData,
		});

		// Touch the games last updated time.
		this._update();
	}

	private _handleMoveTilesMessage(message: MoveTilesMessage, userId: string): void {
		if (!this._gameData.players[userId]) {
			this._messenger.send(userId, {
				type: 'MoveTilesResponseMessage',
				data: { error: 'Invalid player!' },
			});
		}

		if (this._gameData.stage !== HanabiStage.Playing) {
			this._messenger.send(userId, {
				type: 'MoveTilesResponseMessage',
				data: { error: "The game isn't being played right now.!" },
			});
		}

		// Validate that the user owns all these tiles.
		for (const tileId of Object.keys(message.data)) {
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

			const position = this._gameData.tilePositions[tileId];

			if (
				position.x > HANABI_BOARD_SIZE.width - HANABI_TILE_SIZE.width ||
				position.y > HANABI_BOARD_SIZE.height - HANABI_TILE_SIZE.height ||
				position.x < 0 ||
				position.y < 0
			) {
				this._messenger.send(userId, {
					type: 'MoveTilesResponseMessage',
					data: { error: 'Invalid position.' },
				});
			}
		}

		// All tiles are validated. We can update positions now.
		this._gameData.tilePositions = { ...this._gameData.tilePositions, ...message.data };

		// Send success message.
		this._messenger.send(userId, {
			type: 'MoveTilesResponseMessage',
			data: {},
		});

		// Send the updated state to all players/watchers.
		this._messenger.send(this._getAllPlayerAndWatcherIds(), {
			type: 'RefreshGameDataMessage',
			data: this._gameData,
		});

		// Touch the games last updated time.
		this._update();
	}

	private _handleResetGameMessage(_message: ResetGameMessage, userId: string): void {
		if (!this._gameData.players[userId]) {
			this._messenger.send(userId, {
				type: 'ResetGameResponseMessage',
				data: { error: 'Only players can reset the game.' },
			});
		}

		// Generate a new game.
		this._gameData = generateHanabiGameData({
			players: this._gameData.players,
			ruleSet: this._gameData.ruleSet,
		});

		// Send the updated state to all players/watchers.
		this._messenger.send(userId, {
			type: 'ResetGameResponseMessage',
			data: {},
		});

		// Send the updated state to all players/watchers.
		this._messenger.send(this._getAllPlayerAndWatcherIds(), {
			type: 'RefreshGameDataMessage',
			data: this._gameData,
		});

		// Touch the games last updated time.
		this._update();
	}
}
