import { Game, GameState } from '../models/Game';
import {
	SocketMessage,
	GameCreatedMessage,
	InitialDataResponseMessage,
	GameJoinedMessage,
	PlayerAddedMessage,
	PlayerRemovedMessage
} from '../models/SocketMessage';
import ServerSocketManager from './ServerSocketManager';

const GAME_EXPIRATION_MINUTES = 30;

class ServerGameManager {
	private _games: { [code: string]: Game } = {};
	
	public connect() {
		ServerSocketManager.onConnect.subscribe(this._handleConnect);
		ServerSocketManager.onDisconnect.subscribe(this._handleDisconnect);
		ServerSocketManager.onMessage.subscribe(this._handleMessage);
		
		setInterval(this._pruneOldGames, GAME_EXPIRATION_MINUTES * 60 * 1000);
	}
	
	private _startNewGame(ownerId: string) {
		// Make a new game.
		const newGame = new Game(ownerId);
		
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
	}
	
	private _handleDisconnect = ({ userId }: { userId: string }) =>  {
		console.log(`${ userId } disconnected.`);
	}
	
	private _handleCreateGameMessage(userId: string) {
		const game = this._startNewGame(userId);
		
		ServerSocketManager.send(userId, {
			type: 'GameCreatedMessage',
			data: { game: game.toObject() }
		} as GameCreatedMessage);
	}
	
	private _handleRequestInitialDataMessage(userId: string) {
		const playerGame = Object.values(this._games).find(game => !!game.players.find(player => player.id === userId));
		const ownerGame = Object.values(this._games).find(game => game.ownerId === userId);
		const game = playerGame || ownerGame;
		
		ServerSocketManager.send(userId, {
			type: 'InitialDataResponseMessage',
			data: { game: game ? game.toObject() : undefined }
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
		const existingGame = Object.values(this._games).find(game => !!game.players.find(player => player.id === userId));
		
		if (existingGame) {
			// Remove the user from the existing game.
			const removedPlayer = existingGame.removePlayer(userId);
			
			if (removedPlayer) {
				// Make a list of all users we need to notify.
				const removeUserIdsToNotify = [...gameToJoin.players.map(player => player.id), gameToJoin.ownerId];
				
				// Notify all clients that the user has been added.
				for (const removeUserIdToNotify of removeUserIdsToNotify) {
					ServerSocketManager.send(removeUserIdToNotify, {
						type: 'PlayerRemovedMessage',
						data: { player: removedPlayer }
					} as PlayerRemovedMessage);
				}
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
		
		// Make a list of which users (clients + host) to notify.
		const joinUserIdsToNotify = [...gameToJoin.players.map(player => player.id), gameToJoin.ownerId];
		
		// Join the new game.
		const joinedplayer = gameToJoin.addPlayer(userId);
		
		// Respond to the user who joined.
		ServerSocketManager.send(userId, {
			type: 'GameJoinedMessage',
			data: { game: gameToJoin.toObject() }
		} as GameJoinedMessage);
		
		// Notify all clients that the user has been added.
		for (const joinUserIdToNotify of joinUserIdsToNotify) {
			ServerSocketManager.send(joinUserIdToNotify, {
				type: 'PlayerAddedMessage',
				data: { player: joinedplayer }
			} as PlayerAddedMessage);
		}
	}
	
	private _handleMessage = ({ userId, message }: { userId: string, message: SocketMessage }) =>  {
		if (message.type === 'CreateGameMessage') {
			this._handleCreateGameMessage(userId);
		} else if (message.type === 'RequestInitialDataMessage') {
			this._handleRequestInitialDataMessage(userId);
		} else if (message.type === 'JoinGameMessage') {
			this._handleJoinGameMessage(userId, message.data.code);
		}
	}
}

const instance = new ServerGameManager();
export default instance;
