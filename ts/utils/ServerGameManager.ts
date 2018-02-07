import { Game } from '../models/Game';
import { SocketMessage, GameCreatedMessage, InitialDataResponseMessage } from '../models/SocketMessage';
import ServerSocketManager from './ServerSocketManager';

const GAME_EXPIRATION_MINUTES = 30;

export default class GameManager {
	private _games: { [code: string]: Game } = {};
	
	constructor() {
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
	
	private _getGameForUser(userId: string) {
		return Object.values(this._games).find(game => game.players.includes(userId));
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
		const game = this._getGameForUser(userId);
			
		ServerSocketManager.send(userId, {
			type: 'InitialDataResponseMessage',
			data: { game: game ? game.toObject() : undefined }
		} as InitialDataResponseMessage);
	}
	
	private _handleMessage = ({ userId, message }: { userId: string, message: SocketMessage }) =>  {
		if (message.type === 'CreateGameMessage') {
			this._handleCreateGameMessage(userId);
		} else if (message.type === 'RequestInitialDataMessage') {
			this._handleRequestInitialDataMessage(userId);
		}
	}
}
