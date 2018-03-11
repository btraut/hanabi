// ClientGameManager.ts
//
// ClientGameManager serves two purposes. First, it's an abstraction over
// the low level ClientSocketManager. Second, it controls the state of the
// game and keeps it in sync with the server.

import { Dispatch } from 'redux';
import { dispatch as rematchDispatch } from '@rematch/core';

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

const dispatch = rematchDispatch as any as {
	[key: string]: {
		[key: string]: (...data: any[]) => Promise<Dispatch<any>>;
	}
};

export default class ClientGameManager {
	constructor() {
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
			dispatch.connectionState.connect();
			
			// Send initial data fetch request. _handleMessage will get the rest.
			// Expect a response for the sake of timeout error handling.
			const message: RequestInitialDataMessage = { type: 'RequestInitialDataMessage' };
			ClientSocketManager.send(message);
			await ClientSocketManager.expectMessageOfType('InitialDataResponseMessage');
		})();
	}
	
	private _handleDisconnect = () => {
		dispatch.connectionState.disconnect();
		dispatch.userId.clear();
	}
	
	private _handleMessage = (message: SocketMessage) => {
		if (message.type === 'InitialDataResponseMessage') {
			if (message.data.error) {
				// TODO: Handle error.
			} else {
				dispatch.userId.set(message.data.userId || null);
				dispatch.gameData.load(message.data.gameData || null);
				dispatch.connectionState.loadedInitialData();
			}
		} else if (message.type === 'GameCreatedMessage') {
			if (message.data.error) {
				// TODO: Handle error.
			} else {
				dispatch.gameData.load(message.data.gameData || null);
			}
		} else if (message.type === 'GameJoinedMessage') {
			if (message.data.error) {
				dispatch.joinGameError.set(message.data.error);
			} else if (message.data.gameData) {
				// TODO: Fix
				// this._dispatch(gameActions.clearErrors());
				dispatch.gameData.load(message.data.gameData || null);
			}
		} else if (message.type === 'PlayerAddedMessage') {
			if (message.data.error) {
				dispatch.addPlayerError.set(message.data.error);
			} else if (message.data.player && message.data.gameCode) {
				dispatch.gameData.addPlayer(message.data);
			}
		} else if (message.type === 'UserUpdatedMessage') {
			if (message.data.error) {
				dispatch.updateUserError.set(message.data.error);
			} else if (message.data.player && message.data.gameCode) {
				dispatch.gameData.updateUser(message.data);
			}
		} else if (message.type === 'GameStartedMessage') {
			if (message.data.error) {
				dispatch.startGameError.set(message.data.error);
			} else if (message.data.gameCode && message.data.playerOrders) {
				// TODO: Fix
				// this._dispatch(gameActions.clearErrors());
				dispatch.gameData.gameStarted(message.data);
			}
		} else if (message.type === 'PlayerPictureSetMessage') {
			if (message.data.error) {
				dispatch.setPlayerPictureError.set(message.data.error);
			} else if (message.data.pictureData && message.data.gameCode && message.data.playerId) {
				dispatch.gameData.setPlayerPicture(message.data);
			}
		} else if (message.type === 'GameStateSetMessage') {
			if (message.data.error) {
				dispatch.setGameStateError.set(message.data.error);
			} else if (message.data.gameCode) {
				dispatch.gameData.setGameState(message.data);
			}
		} else if (message.type === 'PhraseEnteredMessage') {
			if (message.data.error) {
				dispatch.enterPhraseError.set(message.data.error);
			} else if (message.data.phrase && message.data.gameCode && message.data.playerId) {
				dispatch.gameData.enterPhrase(message.data);
			}
		} else if (message.type === 'PictureEnteredMessage') {
			if (message.data.error) {
				dispatch.enterPictureError.set(message.data.error);
			} else if (message.data.pictureData && message.data.gameCode && message.data.playerId) {
				dispatch.gameData.enterPicture(message.data);
			}
		} else if (message.type === 'ReviewingFinishedMessage') {
			if (message.data.error) {
				dispatch.reviewingFinishedError.set(message.data.error);
			} else if (message.data.gameCode) {
				dispatch.gameData.reviewingFinished(message.data);
			}
		} else if (message.type === 'StartedOverMessage') {
			if (message.data.error) {
				dispatch.startOverError.set(message.data.error);
			} else if (message.data.gameCode && message.data.gameData) {
				dispatch.gameData.startOver(message.data);
			}
		} else if (message.type === 'GameEndedMessage') {
			if (message.data.error) {
				dispatch.endGameError.set(message.data.error);
			} else if (message.data.gameCode) {
				dispatch.gameData.endGame(message.data);
			}
		}
	}
}
