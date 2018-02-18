import { Game, GameState } from '../models/Game';
import Player from '../models/Player';
import {
	SocketMessage,
	GameCreatedMessage,
	InitialDataResponseMessage,
	GameJoinedMessage,
	PlayerAddedMessage,
	UserUpdatedMessage,
	PlayerRemovedMessage,
	GameStartedMessage,
	PlayerNameSetMessage,
	PlayerPictureSetMessage,
	SetGameStateMessage
} from '../models/SocketMessage';
import ServerSocketManager from './ServerSocketManager';
import Logger from '../utils/Logger';
import { MINIMUM_PLAYERS_IN_GAME } from '../models/Rules';

const GAME_EXPIRATION_MINUTES = 30;

class ServerGameManager {
	private _games: { [code: string]: Game } = {};
	
	public connect() {
		ServerSocketManager.onConnect.subscribe(this._handleConnect);
		ServerSocketManager.onDisconnect.subscribe(this._handleDisconnect);
		ServerSocketManager.onMessage.subscribe(this._handleMessage);
		
		setInterval(this._pruneOldGames, GAME_EXPIRATION_MINUTES * 60 * 1000);
	}
	
	private _startNewGame(hostId: string) {
		// Make a new game.
		const newGame = new Game(hostId);
		
		// Make sure the game code is unique.
		while (this._games[newGame.code]) {
			newGame.regenerateCode();
		}
		
		// Save the new game in the games list and return it.
		this._games[newGame.code] = newGame;
		return newGame;
	}
	
	private _pruneOldGames() {
		// Games older than an hour should be deleted.
		const oldestGameTime = new Date((new Date()).getTime() - GAME_EXPIRATION_MINUTES * 60 * 1000);
		
		// Iterate over all games and collect ids of pruned entries.
		const prunedEntries = [];
		for (const code of Object.keys(this._games)) {
			const game = this._games[code];
			
			if (game.updated < oldestGameTime) {
				prunedEntries.push(this._games[code]);
				delete this._games[code];
			}
		}
		
		return prunedEntries;
	}
	
	private _handleConnect = ({ userId }: { userId: string }) => {
		console.log(`${ userId } connected.`);

		try {
			this._updateAllGamesWithUser(userId, { connected: true });
		} catch (error) {
			Logger.warn(error);
		}
	}
	
	private _handleDisconnect = ({ userId }: { userId: string }) =>  {
		console.log(`${ userId } disconnected.`);

		try {
			this._updateAllGamesWithUser(userId, { connected: false });
		} catch (error) {
			Logger.warn(error);
		}
	}
	
	private _updateAllGamesWithUser(userId: string, updates: Partial<Player>) {
		// Update any games that have this user as a player.
		const playerGames = Object.values(this._games).filter(game => !!game.players[userId]);
		
		for (const game of playerGames) {
			// Update the player.
			const updatedUser = game.updatePlayer(userId, updates);
			if (updatedUser) {
				// Notify the game host.
				ServerSocketManager.send(game.allUsers.filter(id => id !== userId), {
					type: 'UserUpdatedMessage',
					data: { player: updatedUser }
				} as UserUpdatedMessage);
			}
		}
		
		// Update any games that have this user as the host.
		const hostGames = Object.values(this._games).filter(game => game.host.id === userId);
		
		for (const game of hostGames) {
			// Update the host.
			const updatedUser = game.updateHost(updates);
			if (updatedUser) {
				// Notify the game players.
				ServerSocketManager.send(Object.values(game.players).map(p => p.id), {
					type: 'UserUpdatedMessage',
					data: { player: updatedUser }
				} as UserUpdatedMessage);
			}
		}
	}
	
	private _handleCreateGameMessage(userId: string) {
		const game = this._startNewGame(userId);
		
		ServerSocketManager.send(userId, {
			type: 'GameCreatedMessage',
			data: { game: game.toObject() }
		} as GameCreatedMessage);
	}
	
	private _handleRequestInitialDataMessage(userId: string) {
		const playerGame = Object.values(this._games).find(game => !!game.players[userId]);
		const hostGame = Object.values(this._games).find(game => game.host.id === userId);
		const game = playerGame || hostGame;
		
		ServerSocketManager.send(userId, {
			type: 'InitialDataResponseMessage',
			data: { game: game ? game.toObject() : undefined, userId }
		} as InitialDataResponseMessage);
	}
	
	private _handleJoinGameMessage(userId: string, gameCode: string) {
		// Check to see if we can find the new game.
		const gameToJoin = this._games[gameCode];
		if (!gameToJoin) {
			ServerSocketManager.send(userId, {
				type: 'GameJoinedMessage',
				data: { error: 'Invalid game code' }
			} as GameJoinedMessage);
			return;
		}
		
		// Check to see if the user is already part of a game.
		const existingGame = Object.values(this._games).find(game => !!game.players[userId]);
		if (existingGame) {
			// Remove the user from the existing game.
			const removedPlayer = existingGame.removePlayer(userId);
			
			if (removedPlayer) {
				// Notify all clients that the user has been added.
				ServerSocketManager.send(gameToJoin.allUsers, {
					type: 'PlayerRemovedMessage',
					data: { player: removedPlayer }
				} as PlayerRemovedMessage);
		}
		}
		
		// Ensure the game is in the right state.
		if (gameToJoin.state !== GameState.WaitingForPlayers) {
			ServerSocketManager.send(userId, {
				type: 'GameJoinedMessage',
				data: { error: 'Game isn’t accepting players right now.' }
			} as GameJoinedMessage);
			return;
		}
		
		// Join the new game.
		const joinedplayer = gameToJoin.addPlayer(userId);
		
		// Respond to the user who joined.
		ServerSocketManager.send(userId, {
			type: 'GameJoinedMessage',
			data: { game: gameToJoin.toObject() }
		} as GameJoinedMessage);
		
		// Notify all clients that the user has been added.
		ServerSocketManager.send(gameToJoin.allUsers, {
			type: 'PlayerAddedMessage',
			data: { player: joinedplayer, gameCode: gameToJoin.code }
		} as PlayerAddedMessage);
	}
	
	private _handleStartGameMessage(userId: string, gameCode: string) {
		// Validate game.
		const game = this._games[gameCode];
		if (!game) {
			ServerSocketManager.send(userId, {
				type: 'GameStartedMessage',
				data: { error: 'Invalid game.' }
			} as GameStartedMessage);
			return;
		}
		
		// Ensure the user is in the game.
		if (!game.players[userId] && game.host.id !== userId) {
			ServerSocketManager.send(userId, {
				type: 'GameStartedMessage',
				data: { error: 'User isn’t a player in or host of this game.' }
			} as GameStartedMessage);
			return;
		}
		
		// Ensure the game is in the right state.
		if (game.state !== GameState.WaitingForPlayers) {
			ServerSocketManager.send(userId, {
				type: 'GameStartedMessage',
				data: { error: 'Game can’t be started right now.' }
			} as GameStartedMessage);
			return;
		}

		// Ensure there are enough players.
		if (Object.keys(game.players).length < MINIMUM_PLAYERS_IN_GAME) {
			ServerSocketManager.send(userId, {
				type: 'GameStartedMessage',
				data: { error: 'Not enough players to start game.' }
			} as GameStartedMessage);
			return;
		}
		
		// Update the game.
		game.start();
		
		// Notify all players and host.
		ServerSocketManager.send(game.allUsers, {
			type: 'GameStartedMessage',
			data: { gameCode }
		} as GameStartedMessage);
	}
	
	private _handleSetPlayerNameMessage(playerId: string, gameCode: string, name: string) {
		// Validate game.
		const game = this._games[gameCode];
		if (!game) {
			ServerSocketManager.send(playerId, {
				type: 'PlayerNameSetMessage',
				data: { error: 'Invalid game.' }
			} as PlayerNameSetMessage);
			return;
		}
		
		// Ensure the user is in the game.
		if (!game.players[playerId] && game.host.id !== playerId) {
			ServerSocketManager.send(playerId, {
				type: 'PlayerNameSetMessage',
				data: { error: 'User isn’t a player in or host of this game.' }
			} as PlayerNameSetMessage);
			return;
		}
		
		// Ensure the game is in the right state.
		if (game.state !== GameState.WaitingForPlayerDescriptions) {
			ServerSocketManager.send(playerId, {
				type: 'PlayerNameSetMessage',
				data: { error: 'User data can’t be updated right now.' }
			} as PlayerNameSetMessage);
			return;
		}
		
		// Update the player name.
		game.updatePlayer(playerId, { name });
		
		// Notify all players and host.
		ServerSocketManager.send(game.allUsers, {
			type: 'PlayerNameSetMessage',
			data: { gameCode, name, playerId }
		} as PlayerNameSetMessage);
	}
	
	private _handleSetPlayerPictureMessage(playerId: string, gameCode: string, pictureData: string) {
		// Validate game.
		const game = this._games[gameCode];
		if (!game) {
			ServerSocketManager.send(playerId, {
				type: 'PlayerPictureSetMessage',
				data: { error: 'Invalid game.' }
			} as PlayerPictureSetMessage);
			return;
		}
		
		// Ensure the user is in the game.
		if (!game.players[playerId] && game.host.id !== playerId) {
			ServerSocketManager.send(playerId, {
				type: 'PlayerPictureSetMessage',
				data: { error: 'User isn’t a player in or host of this game.' }
			} as PlayerPictureSetMessage);
			return;
		}
		
		// Ensure the game is in the right state.
		if (game.state !== GameState.WaitingForPlayerDescriptions) {
			ServerSocketManager.send(playerId, {
				type: 'PlayerPictureSetMessage',
				data: { error: 'User data can’t be updated right now.' }
			} as PlayerPictureSetMessage);
			return;
		}
		
		// Update the player picture data.
		game.updatePlayer(playerId, { pictureData });
		
		// Notify all players and host.
		ServerSocketManager.send(game.allUsers, {
			type: 'PlayerPictureSetMessage',
			data: { gameCode, pictureData, playerId }
		} as PlayerPictureSetMessage);
		
		// Is it time to move to next phase?
		let allPlayersSubmittedPhotos = true;
		for (const player of Object.values(game.players)) {
			if (!player.pictureData) {
				allPlayersSubmittedPhotos = false;
				break;
			}
		}
		
		// Conditionally move to next phase.
		if (allPlayersSubmittedPhotos) {
			game.moveToNextPhase();
			
			ServerSocketManager.send(game.allUsers, {
				type: 'SetGameStateMessage',
				data: { gameCode: game.code, gameState: game.state }
			} as SetGameStateMessage);
		}
	}
	
	private _handleMessage = ({ userId, message }: { userId: string, message: SocketMessage }) =>  {
		try {
			if (message.type === 'CreateGameMessage') {
				this._handleCreateGameMessage(userId);
			} else if (message.type === 'RequestInitialDataMessage') {
				this._handleRequestInitialDataMessage(userId);
			} else if (message.type === 'JoinGameMessage') {
				this._handleJoinGameMessage(userId, message.data.gameCode);
			} else if (message.type === 'StartGameMessage') {
				this._handleStartGameMessage(userId, message.data.gameCode);
			} else if (message.type === 'SetPlayerNameMessage') {
				this._handleSetPlayerNameMessage(userId, message.data.gameCode, message.data.name);
			} else if (message.type === 'SetPlayerPictureMessage') {
				this._handleSetPlayerPictureMessage(userId, message.data.gameCode, message.data.pictureData);
			}
		} catch (error) {
			Logger.warn(error);
		}
	}
}

const instance = new ServerGameManager();
export default instance;
