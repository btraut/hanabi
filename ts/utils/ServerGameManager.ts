import { Game, GameState } from '../models/Game';
import Player from '../models/Player';
import {
	SocketMessageTemplate,
	SocketMessage,
	GameCreatedMessage,
	InitialDataResponseMessage,
	GameJoinedMessage,
	PlayerAddedMessage,
	UserUpdatedMessage,
	GameStartedMessage,
	PlayerPictureSetMessage,
	PhraseEnteredMessage,
	GameStateSetMessage,
	PictureEnteredMessage,
	ReviewingFinishedMessage,
	StartedOverMessage,
	GameEndedMessage
} from '../models/SocketMessage';
import ServerSocketManager from './ServerSocketManager';
import Logger from '../utils/Logger';
import { MINIMUM_PLAYERS_IN_GAME, MAXIMUM_PLAYERS_IN_GAME } from '../models/Rules';

const GAME_EXPIRATION_MINUTES = 30;

type ErrorSocketMessage = SocketMessageTemplate<string, {
	error?: string;
}>;

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
	
	private _pruneOldGames = () => {
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
				const message: UserUpdatedMessage = {
					type: 'UserUpdatedMessage',
					data: { player: updatedUser }
				};
				ServerSocketManager.send(game.allUsers.filter(id => id !== userId), message);
			}
		}
		
		// Update any games that have this user as the host.
		const hostGames = Object.values(this._games).filter(game => game.host.id === userId);
		
		for (const game of hostGames) {
			// Update the host.
			const updatedUser = game.updateHost(updates);
			if (updatedUser) {
				// Notify the game players.
				const message: UserUpdatedMessage = {
					type: 'UserUpdatedMessage',
					data: { player: updatedUser }
				};
				ServerSocketManager.send(Object.values(game.players).map(p => p.id), message);
			}
		}
	}
	
	private _handleCreateGameMessage(userId: string) {
		const game = this._startNewGame(userId);
		
		const message: GameCreatedMessage = {
			type: 'GameCreatedMessage',
			data: { gameData: game.toObject() }
		};
		ServerSocketManager.send(userId, message);
	}
	
	private _handleRequestInitialDataMessage(userId: string) {
		const playerGame = Object.values(this._games).find(g => !!g.players[userId]);
		const hostGame = Object.values(this._games).find(g => g.host.id === userId);
		const game = playerGame || hostGame;
		
		const message: InitialDataResponseMessage = {
			type: 'InitialDataResponseMessage',
			data: { gameData: game ? game.toObject() : undefined, userId }
		};
		ServerSocketManager.send(userId, message);
	}
	
	private _handleJoinGameMessage(playerId: string, gameCode: string, name: string) {
		// Check to see if we can find the new game.
		const gameToJoin = this._games[gameCode];
		if (!gameToJoin) {
			const message: GameJoinedMessage = {
				type: 'GameJoinedMessage',
				data: { error: 'Invalid game code' }
			};
			ServerSocketManager.send(playerId, message);
			return;
		}
		
		// Check if the user is already in the game. If he is, send a
		// success message to him.
		if (gameToJoin.players[playerId]) {
			const message: GameJoinedMessage = {
				type: 'GameJoinedMessage',
				data: { gameData: gameToJoin.toObject() }
			};
			ServerSocketManager.send(playerId, message);
			return;
		}
		
		// Make sure the game to join has room.
		if (Object.keys(gameToJoin.players).length === MAXIMUM_PLAYERS_IN_GAME) {
			const message: GameJoinedMessage = {
				type: 'GameJoinedMessage',
				data: { error: 'Game is full.' }
			};
			ServerSocketManager.send(playerId, message);
			return;
		}
		
		// Ensure the game is in the right state.
		if (gameToJoin.state !== GameState.WaitingForPlayers) {
			const message: GameJoinedMessage = {
				type: 'GameJoinedMessage',
				data: { error: 'Game isn’t accepting players right now.' }
			};
			ServerSocketManager.send(playerId, message);
			return;
		}
		
		// Validate and scrub the name.
		const cleanName = name.trim();
		const error = gameToJoin.validateName(cleanName);
		
		if (error) {
			const message: GameJoinedMessage = {
				type: 'GameJoinedMessage',
				data: { error }
			};
			ServerSocketManager.send(playerId, message);
			return;
		}
		
		// Join the new game.
		const joinedPlayer = gameToJoin.addPlayer(playerId, cleanName);
		
		// Respond to the user who joined.
		const gameJoinedMessage: GameJoinedMessage = {
			type: 'GameJoinedMessage',
			data: { gameData: gameToJoin.toObject() }
		};
		ServerSocketManager.send(playerId, gameJoinedMessage);
		
		// Notify all clients that the user has been added.
		const playerAddedMessage: PlayerAddedMessage = {
			type: 'PlayerAddedMessage',
			data: { player: joinedPlayer, gameCode: gameToJoin.code }
		};
		ServerSocketManager.send(gameToJoin.allUsers, playerAddedMessage);
	}
	
	private _ensureUserIsInGame(errorMessageType: string, userId: string, gameCode: string, gameState?: GameState) {
		// Validate game.
		const game = this._games[gameCode];
		if (!game) {
			const message: ErrorSocketMessage = {
				type: errorMessageType,
				data: { error: 'Invalid game.' }
			};
			ServerSocketManager.send(userId, message as SocketMessage);
			return false;
		}
		
		// Ensure the user is in the game.
		if (!game.players[userId] && game.host.id !== userId) {
			const message: ErrorSocketMessage = {
				type: errorMessageType,
				data: { error: 'User isn’t a player in or host of this game.' }
			};
			ServerSocketManager.send(userId, message as SocketMessage);
			return false;
		}
		
		if (gameState && game.state !== gameState) {
			const message: ErrorSocketMessage = {
				type: errorMessageType,
				data: { error: 'Game isn’t in the right state.' }
			};
			ServerSocketManager.send(userId, message as SocketMessage);
			return;
		}
		
		return true;
	}
	
	private _handleStartGameMessage(userId: string, gameCode: string) {
		// Validate game, membership, and state.
		if (!this._ensureUserIsInGame('GameStartedMessage', userId, gameCode, GameState.WaitingForPlayers)) {
			return;
		}
		
		const game = this._games[gameCode];
		
		// Ensure there are enough players.
		if (Object.keys(game.players).length < MINIMUM_PLAYERS_IN_GAME) {
			const message: GameStartedMessage = {
				type: 'GameStartedMessage',
				data: { error: 'Not enough players to start game.' }
			};
			ServerSocketManager.send(userId, message);
			return;
		}
		
		// Ensure all players have drawn pictures.
		if (Object.values(game.players).find(p => !p.pictureData)) {
			const message: GameStartedMessage = {
				type: 'GameStartedMessage',
				data: { error: 'Not everyone has drawn their own picture yet.' }
			};
			ServerSocketManager.send(userId, message);
			return;
		}
		
		// Update the game.
		game.start();
		game.shufflePlayerOrders();
		
		// Build the list of player orders.
		const playerOrders = Object.values(game.players).sort((a, b) => a.order! < b.order! ? -1 : 1).map(p => p.id);
		
		// Notify all players and host.
		const gameStartedMessage: GameStartedMessage = {
			type: 'GameStartedMessage',
			data: { gameCode, playerOrders }
		};
		ServerSocketManager.send(game.allUsers, gameStartedMessage);
	}
	
	private _checkForNextState(game: Game) {
		let allPlayersSubmitted = true;
		let nextRound = game.currentRound;
		let nextState = game.state;
		
		// Based on the state, check conditions for whether or not
		// we're ready to move to the next.
		if (game.state === GameState.WaitingForPhraseSubmissions) {
			const index = game.currentRound / 2;
			const phrases = game.phrases[index];
			if (!phrases || Object.keys(phrases).length !== Object.keys(game.players).length) {
				allPlayersSubmitted = false;
			}
			
			nextRound = game.currentRound + 1;
			nextState = GameState.WaitingForPictureSubmissions;
		} else if (game.state === GameState.WaitingForPictureSubmissions) {
			const index = (game.currentRound - 1) / 2;
			const pictures = game.pictures[index];
			if (!pictures || Object.keys(pictures).length !== Object.keys(game.players).length) {
				allPlayersSubmitted = false;
			}
			
			nextRound = game.currentRound + 1;
			nextState = GameState.WaitingForPhraseSubmissions;
		}
		
		// If we've hit the max rounds, move to finish.
		if (nextRound >= game.rounds) {
			nextState = GameState.ReviewingStories;
		}
		
		// Conditionally move to next phase.
		if (allPlayersSubmitted) {
			game.moveToState(nextState, nextRound);
			
			const message: GameStateSetMessage = {
				type: 'GameStateSetMessage',
				data: { gameCode: game.code, state: nextState, currentRound: nextRound }
			};
			ServerSocketManager.send(game.allUsers, message);
		}
	}
	
	private _handleSetPlayerPictureMessage(playerId: string, gameCode: string, pictureData: string) {
		// Validate game, membership, and state.
		if (!this._ensureUserIsInGame('PlayerPictureSetMessage', playerId, gameCode, GameState.WaitingForPlayers)) {
			return;
		}
		
		const game = this._games[gameCode];
		
		// Update the player picture data.
		game.updatePlayer(playerId, { pictureData });
		
		// Notify all players and host.
		const message: PlayerPictureSetMessage = {
			type: 'PlayerPictureSetMessage',
			data: { gameCode, pictureData, playerId }
		};
		ServerSocketManager.send(game.allUsers, message);
	}
	
	private _handleEnterPhraseMessage(playerId: string, gameCode: string, round: number, phrase: string) {
		// Validate game, membership, and state.
		if (!this._ensureUserIsInGame('PhraseEnteredMessage', playerId, gameCode, GameState.WaitingForPhraseSubmissions)) {
			return;
		}
		
		const game = this._games[gameCode];
		
		// Validate and scrub the phrase.
		const cleanPhrase = phrase.trim();
		const error = game.validatePhrase(cleanPhrase);
		
		if (error) {
			const message: PhraseEnteredMessage = {
				type: 'PhraseEnteredMessage',
				data: { error }
			};
			ServerSocketManager.send(playerId, message);
			return;
		}
		
		// Set the player's phrase.
		game.enterPhrase(playerId, round, cleanPhrase);
		
		// Notify all players and host.
		const phraseEnteredMessage: PhraseEnteredMessage = {
			type: 'PhraseEnteredMessage',
			data: { gameCode, phrase: cleanPhrase, round: game.currentRound, playerId }
		};
		ServerSocketManager.send(game.allUsers, phraseEnteredMessage);
		
		// Conditionally move to next state.
		this._checkForNextState(game);
	}
	
	private _handleEnterPictureMessage(playerId: string, gameCode: string, round: number, pictureData: string) {
		// Validate game, membership, and state.
		if (!this._ensureUserIsInGame('PictureEnteredMessage', playerId, gameCode, GameState.WaitingForPictureSubmissions)) {
			return;
		}
		
		const game = this._games[gameCode];
		
		// Set the player's phrase.
		game.enterPicture(playerId, round, pictureData);
		
		// Notify all players and host.
		const message: PictureEnteredMessage = {
			type: 'PictureEnteredMessage',
			data: { gameCode, pictureData, round: game.currentRound, playerId }
		};
		ServerSocketManager.send(game.allUsers, message);
		
		// Conditionally move to next state.
		this._checkForNextState(game);
	}
	
	private _handleFinishReviewingMessage(playerId: string, gameCode: string) {
		// Validate game, membership, and state.
		if (!this._ensureUserIsInGame('ReviewingFinishedMessage', playerId, gameCode, GameState.ReviewingStories)) {
			return;
		}
		
		const game = this._games[gameCode];
		game.finishReviewing();
		
		// Notify all players and host.
		const message: ReviewingFinishedMessage = {
			type: 'ReviewingFinishedMessage',
			data: { gameCode }
		};
		ServerSocketManager.send(game.allUsers, message);
	}
	
	private _handleStartOverMessage(playerId: string, gameCode: string) {
		// Validate game, membership, and state.
		if (!this._ensureUserIsInGame('StartedOverMessage', playerId, gameCode, GameState.PlayAgainOptions)) {
			return;
		}
		
		const game = this._games[gameCode];
		
		// Create a new game and add it to the list.
		const newGame = game.startOver();
		newGame.shufflePlayerOrders();
		
		// Make sure the game code is unique.
		while (this._games[newGame.code]) {
			newGame.regenerateCode();
		}
		
		// Add the new game to the list.
		this._games[newGame.code] = newGame;
		
		// Remove the old game from the list.
		delete this._games[gameCode];
		
		// Notify all players and host that the game has restarted.
		const message: StartedOverMessage = {
			type: 'StartedOverMessage',
			data: { gameCode, gameData: newGame.toObject() }
		};
		ServerSocketManager.send(game.allUsers, message);
	}
	
	private _handleEndGameMessage(playerId: string, gameCode: string) {
		// Validate game, membership, and state.
		if (!this._ensureUserIsInGame('GameEndedMessage', playerId, gameCode, GameState.PlayAgainOptions)) {
			return;
		}
		
		const game = this._games[gameCode];
		
		// Remove the old game from the list.
		delete this._games[gameCode];
		
		// Notify all players and host.
		const message: GameEndedMessage = {
			type: 'GameEndedMessage',
			data: { gameCode }
		};
		ServerSocketManager.send(game.allUsers, message);
	}
	
	private static _cleanGameCode(gameCode: string) {
		return gameCode.trim().toLowerCase();
	}
	
	private _handleMessage = ({ userId, message }: { userId: string, message: SocketMessage }) => {
		try {
			if (message.type === 'CreateGameMessage') {
				this._handleCreateGameMessage(userId);
			} else if (message.type === 'RequestInitialDataMessage') {
				this._handleRequestInitialDataMessage(userId);
			} else if (message.type === 'JoinGameMessage') {
				this._handleJoinGameMessage(
					userId,
					ServerGameManager._cleanGameCode(message.data.gameCode),
					message.data.name
				);
			} else if (message.type === 'StartGameMessage') {
				this._handleStartGameMessage(userId, ServerGameManager._cleanGameCode(message.data.gameCode));
			} else if (message.type === 'SetPlayerPictureMessage') {
				this._handleSetPlayerPictureMessage(
					userId,
					ServerGameManager._cleanGameCode(message.data.gameCode),
					message.data.pictureData
				);
			} else if (message.type === 'EnterPhraseMessage') {
				this._handleEnterPhraseMessage(
					userId,
					ServerGameManager._cleanGameCode(message.data.gameCode),
					message.data.round,
					message.data.phrase
				);
			} else if (message.type === 'EnterPictureMessage') {
				this._handleEnterPictureMessage(
					userId,
					ServerGameManager._cleanGameCode(message.data.gameCode),
					message.data.round,
					message.data.pictureData
				);
			} else if (message.type === 'FinishReviewingMessage') {
				this._handleFinishReviewingMessage(userId, ServerGameManager._cleanGameCode(message.data.gameCode));
			} else if (message.type === 'StartOverMessage') {
				this._handleStartOverMessage(userId, ServerGameManager._cleanGameCode(message.data.gameCode));
			} else if (message.type === 'EndGameMessage') {
				this._handleEndGameMessage(userId, ServerGameManager._cleanGameCode(message.data.gameCode));
			}
		} catch (error) {
			Logger.warn(error);
		}
	}
}

const instance = new ServerGameManager();
export default instance;
