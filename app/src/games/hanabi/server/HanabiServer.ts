import {
	generateHanabiGameData,
	generatePlayer,
	generateRandomDeck,
	HANABI_DEFAULT_TILE_POSITIONS,
	HANABI_GAME_TITLE,
	HANABI_MAX_POSITION,
	HANABI_MIN_PLAYERS,
	HANABI_TILES_IN_HAND,
	HanabiFinishedReason,
	HanabiGameActionType,
	HanabiGameData,
	HanabiRuleSet,
	HanabiStage,
	HanabiTile,
} from 'app/src/games/hanabi/HanabiGameData';
import {
	AddPlayerMessage,
	ChangeGameSettingsMessage,
	DiscardTileMessage,
	getScope,
	GiveClueMessage,
	HanabiMessage,
	MoveTileMessage,
	PlayTileMessage,
	RemovePlayerMessage,
	StartGameMessage,
} from 'app/src/games/hanabi/HanabiMessages';
import Game from 'app/src/games/server/Game';
import GameMessenger from 'app/src/games/server/GameMessenger';
import UserConnectionListener, {
	UserConnectionChange,
} from 'app/src/games/server/UserConnectionListener';
import ServerSocketManager from 'app/src/utils/server/SocketManager';

// https://davidgomes.com/pick-omit-over-union-types-in-typescript/
type DistributiveOmit<T, K extends keyof T> = T extends unknown ? Omit<T, K> : never;

export default class HanabiGame extends Game {
	public static title = HANABI_GAME_TITLE;

	public static factory(
		userId: string,
		socketManager: ServerSocketManager<HanabiMessage>,
	): HanabiGame {
		return new HanabiGame(userId, socketManager);
	}

	private _gameData: HanabiGameData = generateHanabiGameData();

	private _messenger: GameMessenger<HanabiMessage>;
	private _userConnectionListener: UserConnectionListener;

	constructor(userId: string, socketManager: ServerSocketManager<HanabiMessage>) {
		super(userId);

		this._messenger = new GameMessenger(socketManager, getScope(HANABI_GAME_TITLE, this.id));
		this._messenger.connect(this._handleMessage);

		this._userConnectionListener = new UserConnectionListener(socketManager);
		this._userConnectionListener.start(this._handleUserConnectionChange);
	}

	public cleanUp(): void {
		this._messenger.disconnect();
		this._userConnectionListener.stop();
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
			case 'MoveTileMessage':
				this._handleMoveTileMessage(message, userId);
				break;
		}
	};

	private _sendMessage(
		userIdOrIds: string | readonly string[],
		message: DistributiveOmit<HanabiMessage, 'scope'>,
	) {
		this._messenger.send(userIdOrIds, {
			...message,
			scope: getScope(HANABI_GAME_TITLE, this.id),
		});
	}

	private _handleUserConnectionChange = (userId: string, change: UserConnectionChange) => {
		if (!this._gameData.players[userId]) {
			return;
		}

		this._gameData.players[userId].connected = change === UserConnectionChange.Authenticated;

		this._sendMessage(this._getAllPlayerAndWatcherIds(), {
			type: 'RefreshGameDataMessage',
			data: this._gameData,
		});

		// Touch the games last updated time.
		this._update();
	};

	private _sendGameData(playerId: string): void {
		this._sendMessage(playerId, {
			type: 'RefreshGameDataMessage',
			data: this._gameData,
		});

		// Touch the games last updated time.
		this._update();
	}

	private _handleAddPlayerMessage({ data: { name } }: AddPlayerMessage, playerId: string): void {
		// Error if already started.
		if (this._gameData.stage !== HanabiStage.Setup) {
			this._sendMessage(playerId, {
				type: 'AddPlayerResponseMessage',
				data: {
					error: 'Cannot join game because it has already started.',
				},
			});
			return;
		}

		// Add the player to the player list.
		const player = generatePlayer({ id: playerId, name });
		this._gameData.players[playerId] = player;

		// Success! Respond to the creator.
		this._sendMessage(playerId, {
			type: 'AddPlayerResponseMessage',
			data: {},
		});

		// Send the updated state to all players/watchers.
		this._sendMessage(this._getAllPlayerAndWatcherIds(), {
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
			this._sendMessage(userId, {
				type: 'RemovePlayerResponseMessage',
				data: {
					error: 'Cannot remove user from game because it has already started.',
				},
			});
			return;
		}

		delete this._gameData.players[removeUserId];

		this._sendMessage(userId, {
			type: 'RemovePlayerResponseMessage',
			data: {},
		});

		// Send the updated state to all players/watchers.
		this._sendMessage(this._getAllPlayerAndWatcherIds(), {
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
			this._sendMessage(userId, {
				type: 'StartGameResponseMessage',
				data: {
					error: 'Cannot change game settings after it has started.',
				},
			});
			return;
		}

		if (!this._gameData.players[userId]) {
			this._sendMessage(userId, {
				type: 'StartGameResponseMessage',
				data: {
					error: 'Only players can change game settings.',
				},
			});
			return;
		}

		// Settings specific validation:
		if (typeof message.data.ruleSet === 'number') {
			if (
				![HanabiRuleSet.Basic, HanabiRuleSet.PurpleDecoy, HanabiRuleSet.PurpleDistinct].includes(
					message.data.ruleSet,
				)
			) {
				this._sendMessage(userId, {
					type: 'StartGameResponseMessage',
					data: {
						error: 'Invalid rules set.',
					},
				});
				return;
			}

			this._gameData.ruleSet = message.data.ruleSet;
		}

		// Send the updated state to all players/watchers.
		this._sendMessage(this._getAllPlayerAndWatcherIds(), {
			type: 'RefreshGameDataMessage',
			data: this._gameData,
		});

		// Touch the games last updated time.
		this._update();
	}

	private _handleStartGameMessage(_message: StartGameMessage, userId: string): void {
		// Validate that the game is ready.
		if (this._gameData.stage !== HanabiStage.Setup) {
			this._sendMessage(userId, {
				type: 'StartGameResponseMessage',
				data: {
					error: 'Cannot start game because it has already started.',
				},
			});
			return;
		}

		if (Object.keys(this._gameData.players).length < HANABI_MIN_PLAYERS) {
			this._sendMessage(userId, {
				type: 'StartGameResponseMessage',
				data: {
					error: 'Not enough players to play.',
				},
			});
			return;
		}

		if (!this._gameData.players[userId]) {
			this._sendMessage(userId, {
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
		const tiles = generateRandomDeck(this._gameData.ruleSet !== HanabiRuleSet.Basic);
		const tilesInHand = HANABI_TILES_IN_HAND[players.length];

		for (const player of players) {
			for (let i = 0; i < tilesInHand; i += 1) {
				const tile = tiles.pop()!;
				player.tileLocations.push({
					position: HANABI_DEFAULT_TILE_POSITIONS[i],
					tile,
				});
			}
		}

		// Send success message.
		this._sendMessage(userId, {
			type: 'StartGameResponseMessage',
			data: {},
		});

		// Send the updated state to all players/watchers.
		this._sendMessage(this._getAllPlayerAndWatcherIds(), {
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
			return 'The game isn’t being played right now.';
		}

		if (this._gameData.turnOrder[0] !== userId) {
			return 'It’s not your turn!';
		}

		return null;
	}

	private _discardedTileIsFatal(tile: HanabiTile): boolean {
		// Check remaining tiles for a copy.
		if (
			this._gameData.remainingTiles.find((t) => t.color === tile.color && t.number === tile.number)
		) {
			return true;
		}

		// Check players' hands for a copy.
		for (const player of Object.values(this._gameData.players)) {
			if (
				player.tileLocations
					.map((l) => l.tile)
					.find((t) => t.color === tile.color && t.number === tile.number)
			) {
				return true;
			}
		}

		// No copy left in play. Game is failed.
		return false;
	}

	private _handlePlayTileMessage(message: PlayTileMessage, userId: string): void {
		const gameActionError = this._validateGameAction(userId);
		if (gameActionError) {
			this._sendMessage(userId, {
				type: 'PlayTileResponseMessage',
				data: { error: gameActionError },
			});
			return;
		}

		const tile = this._gameData.players[userId].tileLocations
			.map((l) => l.tile)
			.find((t) => t.id === message.data.id);

		if (!tile) {
			this._sendMessage(userId, {
				type: 'PlayTileResponseMessage',
				data: { error: 'That tile isn’t in your hand!' },
			});
			return;
		}

		// Remove the tile from the player.
		this._gameData.players[userId].tileLocations = this._gameData.players[
			userId
		].tileLocations.filter((l) => l.tile.id !== tile.id);

		// Pick up another tile if available.
		if (this._gameData.remainingTiles.length) {
			const newTile = this._gameData.remainingTiles.pop()!;
			this._gameData.players[userId].tileLocations.push({
				tile: newTile,
				position: { x: 0, y: 0 },
			});
		}

		// Check if the tile is valid.
		const duplicate = !!this._gameData.playedTiles.find(
			(t) => t.color === tile.color && t.number === tile.number,
		);
		const prevNumberInSequenceExists = !!(
			tile.number === 1 &&
			this._gameData.playedTiles.find((t) => t.color === tile.color && t.number === tile.number - 1)
		);

		const tileIsValid = !duplicate && prevNumberInSequenceExists;

		if (tileIsValid) {
			this._gameData.playedTiles.push(tile);

			if (tile.number === 5) {
				this._gameData.clues += 1;
			}
		} else {
			if (this._gameData.lives === 0) {
				this._gameData.stage = HanabiStage.Finished;
				this._gameData.finishedReason = HanabiFinishedReason.OutOfLives;
			} else {
				this._gameData.lives -= 1;
			}

			this._gameData.discardedTiles.push(tile);
		}

		// Detect if the game is over due to the wrong tile being discarded.
		if (!tileIsValid && this._discardedTileIsFatal(tile)) {
			this._gameData.stage = HanabiStage.Finished;
			this._gameData.finishedReason = HanabiFinishedReason.DiscardedFatalTile;
		}

		// If there's no longer any remaining tiles, start the shot clock.
		if (this._gameData.remainingTurns === null) {
			// Did we run out of tiles?
			if (this._gameData.remainingTiles.length === 0) {
				// Start the shot clock.
				this._gameData.remainingTurns = Object.keys(this._gameData.players).length;
			}
		} else {
			// Advance the shot clock.
			this._gameData.remainingTurns -= 1;

			// If it runs out, game over.
			if (this._gameData.remainingTurns === 0) {
				this._gameData.stage = HanabiStage.Finished;
				this._gameData.finishedReason = HanabiFinishedReason.OutOfTurns;
			}
		}

		// Detect if the game has been won.
		const maxPlayedTiles = this._gameData.ruleSet === HanabiRuleSet.Basic ? 25 : 30;
		if (maxPlayedTiles) {
			this._gameData.stage = HanabiStage.Finished;
			this._gameData.finishedReason = HanabiFinishedReason.Won;
		}

		// Advance the turn.
		this._gameData.turnOrder.push(this._gameData.turnOrder.shift()!);

		// Record the action.
		this._gameData.actions.push({
			playerId: userId,
			action: HanabiGameActionType.Play,
			valid: tileIsValid,
		});

		// Send success message.
		this._sendMessage(userId, {
			type: 'PlayTileResponseMessage',
			data: {},
		});

		// Send the updated state to all players/watchers.
		this._sendMessage(this._getAllPlayerAndWatcherIds(), {
			type: 'RefreshGameDataMessage',
			data: this._gameData,
		});

		// Touch the games last updated time.
		this._update();
	}

	private _handleDiscardTileMessage(message: DiscardTileMessage, userId: string): void {
		const gameActionError = this._validateGameAction(userId);
		if (gameActionError) {
			this._sendMessage(userId, {
				type: 'DiscardTileResponseMessage',
				data: { error: gameActionError },
			});
			return;
		}

		const tile = this._gameData.players[userId].tileLocations
			.map((l) => l.tile)
			.find((t) => t.id === message.data.id);

		if (!tile) {
			this._sendMessage(userId, {
				type: 'DiscardTileResponseMessage',
				data: { error: 'That tile isn’t in your hand!' },
			});
			return;
		}

		// Remove the tile from the player.
		this._gameData.players[userId].tileLocations = this._gameData.players[
			userId
		].tileLocations.filter((l) => l.tile.id !== tile.id);

		// Pick up another tile if available.
		if (this._gameData.remainingTiles.length) {
			const newTile = this._gameData.remainingTiles.pop()!;
			this._gameData.players[userId].tileLocations.push({
				tile: newTile,
				position: { x: 0, y: 0 },
			});
		}

		// Detect if the game is over due to the wrong tile being discarded.
		if (this._discardedTileIsFatal(tile)) {
			this._gameData.stage = HanabiStage.Finished;
			this._gameData.finishedReason = HanabiFinishedReason.DiscardedFatalTile;
		}

		// If there's no longer any remaining tiles, start the shot clock.
		if (this._gameData.remainingTurns === null) {
			// Did we run out of tiles?
			if (this._gameData.remainingTiles.length === 0) {
				// Start the shot clock.
				this._gameData.remainingTurns = Object.keys(this._gameData.players).length;
			}
		} else {
			// Advance the shot clock.
			this._gameData.remainingTurns -= 1;

			// If it runs out, game over.
			if (this._gameData.remainingTurns === 0) {
				this._gameData.stage = HanabiStage.Finished;
				this._gameData.finishedReason = HanabiFinishedReason.OutOfTurns;
			}
		}

		// Add a clue.
		this._gameData.clues += 1;

		// Advance the turn.
		this._gameData.turnOrder.push(this._gameData.turnOrder.shift()!);

		// Record the action.
		this._gameData.actions.push({
			playerId: userId,
			action: HanabiGameActionType.Discard,
		});

		// Send success message.
		this._sendMessage(userId, {
			type: 'DiscardTileResponseMessage',
			data: {},
		});

		// Send the updated state to all players/watchers.
		this._sendMessage(this._getAllPlayerAndWatcherIds(), {
			type: 'RefreshGameDataMessage',
			data: this._gameData,
		});

		// Touch the games last updated time.
		this._update();
	}

	private _handleGiveClueMessage(message: GiveClueMessage, userId: string): void {
		const gameActionError = this._validateGameAction(userId);
		if (gameActionError) {
			this._sendMessage(userId, {
				type: 'GiveClueResponseMessage',
				data: { error: gameActionError },
			});
			return;
		}

		// Make sure there's a clue to spare.
		if (this._gameData.clues === 0) {
			this._sendMessage(userId, {
				type: 'GiveClueResponseMessage',
				data: { error: 'No clues remaining.' },
			});
		}

		// Decrement clue count.
		this._gameData.clues -= 1;

		// Record the action.
		this._gameData.actions.push({
			playerId: userId,
			action: HanabiGameActionType.GiveClue,
			recipientId: message.data.to,
			color: message.data.color,
			number: message.data.number,
		});

		// Send success message.
		this._sendMessage(userId, {
			type: 'GiveClueResponseMessage',
			data: {},
		});

		// Send the updated state to all players/watchers.
		this._sendMessage(this._getAllPlayerAndWatcherIds(), {
			type: 'RefreshGameDataMessage',
			data: this._gameData,
		});

		// Touch the games last updated time.
		this._update();
	}

	private _handleMoveTileMessage(message: MoveTileMessage, userId: string): void {
		if (!this._gameData.players[userId]) {
			this._sendMessage(userId, {
				type: 'MoveTileResponseMessage',
				data: { error: 'Invalid player!' },
			});
		}

		if (this._gameData.stage !== HanabiStage.Playing) {
			this._sendMessage(userId, {
				type: 'MoveTileResponseMessage',
				data: { error: 'The game isn’t being played right now.!' },
			});
		}

		const tileLocation = this._gameData.players[userId].tileLocations.find(
			(t) => t.tile.id === message.data.id,
		);

		if (!tileLocation) {
			this._sendMessage(userId, {
				type: 'MoveTileResponseMessage',
				data: { error: 'That tile isn’t in your hand!' },
			});
			return;
		}

		const { x, y } = message.data;

		if (x > HANABI_MAX_POSITION.x || y > HANABI_MAX_POSITION.y || x < 0 || y < 0) {
			this._sendMessage(userId, {
				type: 'MoveTileResponseMessage',
				data: { error: 'Invalid position.' },
			});
		}

		// Move the tile.
		tileLocation.position = { x, y };

		// Send success message.
		this._sendMessage(userId, {
			type: 'PlayTileResponseMessage',
			data: {},
		});

		// Send the updated state to all players/watchers.
		this._sendMessage(this._getAllPlayerAndWatcherIds(), {
			type: 'RefreshGameDataMessage',
			data: this._gameData,
		});

		// Touch the games last updated time.
		this._update();
	}
}
