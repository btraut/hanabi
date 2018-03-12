// ClientGameManager.ts
//
// ClientGameManager serves two purposes. First, it's an abstraction over
// the low level ClientSocketManager. Second, it controls the state of the
// game and keeps it in sync with the server.

import { Dispatch } from 'redux';

import { StoreData } from '../reducers/root';
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
	AdvanceStoryReviewMessage,
	StartOverMessage,
	EndGameMessage
} from '../models/SocketMessage';

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
	
	public async advanceStoryReview(gameCode: string) {
		// Move to the next round of story review. Expect a response for the sake of error handling.
		const message: AdvanceStoryReviewMessage = { type: 'AdvanceStoryReviewMessage', data: { gameCode } };
		ClientSocketManager.send(message);
		await ClientSocketManager.expectMessageOfType('AdvancedStoryReviewMessage');
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
	
	private _handleConnect = async () => {
		// Note that we've connected, but haven't yet gotten initial data.
		this._dispatch({ type: 'connectionState/connect' });
		
		// Send initial data fetch request. _handleMessage will get the rest.
		// Expect a response for the sake of timeout error handling.
		const message: RequestInitialDataMessage = { type: 'RequestInitialDataMessage' };
		ClientSocketManager.send(message);
		await ClientSocketManager.expectMessageOfType('InitialDataResponseMessage');
	}
	
	private _handleDisconnect = () => {
		this._dispatch({ type: 'connectionState/disconnect' });
		this._dispatch({ type: 'userId/clear' });
	}
	
	private _handleMessage = (message: SocketMessage) => {
		if (message.type === 'InitialDataResponseMessage') {
			if (message.data.error) {
				// TODO: Handle error.
			} else {
				this._dispatch({ type: 'userId/set', payload: message.data.userId || null });
				this._dispatch({ type: 'gameData/set', payload: message.data.gameData || null });
				this._dispatch({ type: 'connectionState/loadedInitialData' });
			}
		} else if (message.type === 'GameCreatedMessage') {
			if (message.data.error) {
				// TODO: Handle error.
			} else {
				this._dispatch({ type: 'gameData/set', payload: message.data.gameData || null });
			}
		} else if (message.type === 'GameJoinedMessage') {
			if (message.data.error) {
				this._dispatch({ type: 'joinGameError/set', payload: message.data.error });
			} else if (message.data.gameData) {
				// TODO: Fix
				// this._dispatch(gameActions.clearErrors());
				this._dispatch({ type: 'gameData/set', payload: message.data.gameData || null });
			}
		} else if (message.type === 'PlayerAddedMessage') {
			if (message.data.error) {
				this._dispatch({ type: 'addPlayerError/set', payload: message.data.error });
			} else if (message.data.player && message.data.gameCode) {
				this._dispatch({ type: 'gameData/addPlayer', payload: message.data });
			}
		} else if (message.type === 'UserUpdatedMessage') {
			if (message.data.error) {
				this._dispatch({ type: 'updateUserError/set', payload: message.data.error });
			} else if (message.data.player && message.data.gameCode) {
				this._dispatch({ type: 'gameData/updateUser', payload: message.data });
			}
		} else if (message.type === 'GameStartedMessage') {
			if (message.data.error) {
				this._dispatch({ type: 'startGameError/set', payload: message.data.error });
			} else if (message.data.gameCode && message.data.playerOrders) {
				// TODO: Fix
				// this._dispatch(gameActions.clearErrors());
				this._dispatch({ type: 'gameData/gameStarted', payload: message.data });
			}
		} else if (message.type === 'PlayerPictureSetMessage') {
			if (message.data.error) {
				this._dispatch({ type: 'setPlayerPictureError/set', payload: message.data.error });
			} else if (message.data.pictureData && message.data.gameCode && message.data.playerId) {
				this._dispatch({ type: 'gameData/setPlayerPicture', payload: message.data });
			}
		} else if (message.type === 'GameStateSetMessage') {
			if (message.data.error) {
				this._dispatch({ type: 'setGameStateError/set', payload: message.data.error });
			} else if (message.data.gameCode) {
				this._dispatch({ type: 'gameData/setGameState', payload: message.data });
			}
		} else if (message.type === 'PhraseEnteredMessage') {
			if (message.data.error) {
				this._dispatch({ type: 'enterPhraseError/set', payload: message.data.error });
			} else if (message.data.phrase && message.data.gameCode && message.data.playerId) {
				this._dispatch({ type: 'gameData/enterPhrase', payload: message.data });
			}
		} else if (message.type === 'PictureEnteredMessage') {
			if (message.data.error) {
				this._dispatch({ type: 'enterPictureError/set', payload: message.data.error });
			} else if (message.data.pictureData && message.data.gameCode && message.data.playerId) {
				this._dispatch({ type: 'gameData/enterPicture', payload: message.data });
			}
		} else if (message.type === 'AdvancedStoryReviewMessage') {
			if (message.data.error) {
				this._dispatch({ type: 'advanceStoryReviewError/set', payload: message.data.error });
			} else if (message.data.gameCode) {
				this._dispatch({ type: 'gameData/advanceStoryReview', payload: message.data });
			}
		} else if (message.type === 'StartedOverMessage') {
			if (message.data.error) {
				this._dispatch({ type: 'startOverError/set', payload: message.data.error });
			} else if (message.data.gameCode && message.data.gameData) {
				this._dispatch({ type: 'gameData/startOver', payload: message.data });
			}
		} else if (message.type === 'GameEndedMessage') {
			if (message.data.error) {
				this._dispatch({ type: 'endGameError/set', payload: message.data.error });
			} else if (message.data.gameCode) {
				this._dispatch({ type: 'gameData/endGame', payload: message.data });
			}
		}
	}
}
