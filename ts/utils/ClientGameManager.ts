// ClientGameManager.ts
//
// ClientGameManager serves two purposes. First, it's an abstraction over
// the low level ClientSocketManager. Second, it controls the state of the
// game and keeps it in sync with the server.

import { Dispatch } from 'react-redux';

import ClientSocketManager from './ClientSocketManager';
import {
	SocketMessage,
	RequestInitialDataMessage,
	CreateGameMessage,
	JoinGameMessage,
	StartGameMessage,
	SetPlayerPictureMessage,
	EnterPhraseMessage,
	EnterPictureMessage,
	FinishReviewingMessage,
	StartOverMessage,
	EndGameMessage
} from '../models/SocketMessage';
import { StoreData } from '../reducers/root';
import { gameActions } from '../reducers/Game';

export default class ClientGameManager {
	private _dispatch: Dispatch<StoreData>;

	constructor(dispatch: Dispatch<StoreData>) {
		this._dispatch = dispatch;
		
		ClientSocketManager.onConnect.subscribe(this._handleConnect);
		ClientSocketManager.onDisconnect.subscribe(this._handleDisconnect);
		ClientSocketManager.onMessage.subscribe(this._handleMessage);
	}
	
	public connect() {
		ClientSocketManager.connect();
	}
	
	public disconnect() {
		ClientSocketManager.disconnect();
	}
	
	public async createGame() {
		// Call to create a game. Expect a response for the sake of error handling.
		const message: CreateGameMessage = { type: 'CreateGameMessage' };
		ClientSocketManager.send(message);
		await ClientSocketManager.expectMessageOfType('GameCreatedMessage');
	}
	
	public async joinGame(gameCode: string, name: string) {
		// Call to join a game. Expect a response for the sake of error handling.
		const message: JoinGameMessage = { type: 'JoinGameMessage', data: { gameCode, name } };
		ClientSocketManager.send(message);
		await ClientSocketManager.expectMessageOfType('GameJoinedMessage');
	}
	
	public async startGame(gameCode: string) {
		// Call to start the game. Expect a response for the sake of error handling.
		const message: StartGameMessage = { type: 'StartGameMessage', data: { gameCode } };
		ClientSocketManager.send(message);
		await ClientSocketManager.expectMessageOfType('GameStartedMessage');
	}
	
	public async setPlayerPicture(gameCode: string, pictureData: string) {
		// Send the player's picture data. Expect a response for the sake of error handling.
		const message: SetPlayerPictureMessage = { type: 'SetPlayerPictureMessage', data: { gameCode, pictureData } };
		ClientSocketManager.send(message);
		await ClientSocketManager.expectMessageOfType('PlayerPictureSetMessage');
	}
	
	public async enterPhrase(gameCode: string, round: number, phrase: string) {
		// Send the player's phrase. Expect a response for the sake of error handling.
		const message: EnterPhraseMessage = { type: 'EnterPhraseMessage', data: { gameCode, phrase, round } };
		ClientSocketManager.send(message);
		await ClientSocketManager.expectMessageOfType('PhraseEnteredMessage');
	}
	
	public async enterPicture(gameCode: string, round: number, pictureData: string) {
		// Send the player's picture. Expect a response for the sake of error handling.
		const message: EnterPictureMessage = { type: 'EnterPictureMessage', data: { gameCode, pictureData, round } };
		ClientSocketManager.send(message);
		await ClientSocketManager.expectMessageOfType('PictureEnteredMessage');
	}
	
	public async finishReviewing(gameCode: string) {
		// Set the game state. Expect a response for the sake of error handling.
		const message: FinishReviewingMessage = { type: 'FinishReviewingMessage', data: { gameCode } };
		ClientSocketManager.send(message);
		await ClientSocketManager.expectMessageOfType('ReviewingFinishedMessage');
	}
	
	public async startOver(gameCode: string) {
		// Send the start over message. Expect a response for the sake of error handling.
		const message: StartOverMessage = { type: 'StartOverMessage', data: { gameCode } };
		ClientSocketManager.send(message);
		await ClientSocketManager.expectMessageOfType('StartedOverMessage');
	}
	
	public async endGame(gameCode: string) {
		// Send the end game message. Expect a response for the sake of error handling.
		const message: EndGameMessage = { type: 'EndGameMessage', data: { gameCode } };
		ClientSocketManager.send(message);
		await ClientSocketManager.expectMessageOfType('GameEndedMessage');
	}
	
	private _handleConnect = () => {
		(async () => {
			// Note that we've connected, but haven't yet gotten initial data.
			this._dispatch(gameActions.connect());
			
			// Send initial data fetch request. _handleMessage will get the rest.
			// Expect a response for the sake of timeout error handling.
			const message: RequestInitialDataMessage = { type: 'RequestInitialDataMessage' };
			ClientSocketManager.send(message);
			await ClientSocketManager.expectMessageOfType('InitialDataResponseMessage');
		})();
	}
	
	private _handleDisconnect = () => {
		this._dispatch(gameActions.disconnect());
	}
	
	private _handleMessage = (message: SocketMessage) => {
		if (message.type === 'InitialDataResponseMessage') {
			if (message.data.error) {
				// TODO: Handle error.
			} else {
				this._dispatch(gameActions.loadUserId(message.data.userId || null));
				this._dispatch(gameActions.loadGame(message.data.game || null));
			}
		} else if (message.type === 'GameCreatedMessage') {
			if (message.data.error) {
				// TODO: Handle error.
			} else {
				this._dispatch(gameActions.loadGame(message.data.gameData || null));
			}
		} else if (message.type === 'GameJoinedMessage') {
			if (message.data.error) {
				this._dispatch(gameActions.joinGameError(message.data.error));
			} else if (message.data.gameData) {
				this._dispatch(gameActions.clearErrors());
				this._dispatch(gameActions.loadGame(message.data.gameData || null));
			}
		} else if (message.type === 'PlayerAddedMessage') {
			if (message.data.error) {
				this._dispatch(gameActions.addPlayerError(message.data.error));
			} else if (message.data.player && message.data.gameCode) {
				this._dispatch(gameActions.addPlayer(message.data.player, message.data.gameCode));
			}
		} else if (message.type === 'UserUpdatedMessage') {
			if (message.data.error) {
				this._dispatch(gameActions.updateUserError(message.data.error));
			} else if (message.data.player && message.data.gameCode) {
				this._dispatch(gameActions.updateUser(message.data.player, message.data.gameCode));
			}
		} else if (message.type === 'GameStartedMessage') {
			if (message.data.error) {
				this._dispatch(gameActions.startGameError(message.data.error));
			} else if (message.data.gameCode && message.data.playerOrders) {
				this._dispatch(gameActions.clearErrors());
				this._dispatch(gameActions.gameStarted(message.data.gameCode, message.data.playerOrders));
			}
		} else if (message.type === 'PlayerPictureSetMessage') {
			if (message.data.error) {
				this._dispatch(gameActions.setPlayerPictureError(message.data.error));
			} else if (message.data.pictureData && message.data.gameCode && message.data.playerId) {
				this._dispatch(gameActions.setPlayerPicture(message.data.playerId, message.data.pictureData, message.data.gameCode));
			}
		} else if (message.type === 'GameStateSetMessage') {
			if (message.data.error) {
				this._dispatch(gameActions.setGameStateError(message.data.error));
			} else if (message.data.gameCode) {
				this._dispatch(gameActions.setGameState(message.data.gameCode, message.data.gameState, message.data.currentRound));
			}
		} else if (message.type === 'PhraseEnteredMessage') {
			if (message.data.error) {
				this._dispatch(gameActions.enterPhraseError(message.data.error));
			} else if (message.data.phrase && message.data.gameCode && message.data.playerId) {
				this._dispatch(gameActions.enterPhrase(message.data.playerId, message.data.phrase, message.data.gameCode));
			}
		} else if (message.type === 'PictureEnteredMessage') {
			if (message.data.error) {
				this._dispatch(gameActions.enterPictureError(message.data.error));
			} else if (message.data.pictureData && message.data.gameCode && message.data.playerId) {
				this._dispatch(gameActions.enterPicture(message.data.playerId, message.data.pictureData, message.data.gameCode));
			}
		} else if (message.type === 'ReviewingFinishedMessage') {
			if (message.data.error) {
				this._dispatch(gameActions.reviewingFinishedError(message.data.error));
			} else if (message.data.gameCode) {
				this._dispatch(gameActions.reviewingFinished(message.data.gameCode));
			}
		} else if (message.type === 'StartedOverMessage') {
			if (message.data.error) {
				this._dispatch(gameActions.startOverError(message.data.error));
			} else if (message.data.gameCode && message.data.gameData) {
				this._dispatch(gameActions.startOver(message.data.gameCode, message.data.gameData));
			}
		} else if (message.type === 'GameEndedMessage') {
			if (message.data.error) {
				this._dispatch(gameActions.endGameError(message.data.error));
			} else if (message.data.gameCode) {
				this._dispatch(gameActions.endGame(message.data.gameCode));
			}
		}
	}
}
