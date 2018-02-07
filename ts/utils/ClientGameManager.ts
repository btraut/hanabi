// ClientGameManager.ts
//
// ClientGameManager serves two purposes. First, it's an abstraction over
// the low level ClientSocketManager. Second, it controls the state of the
// game and keeps it in sync with the server.

import { Dispatch } from 'react-redux';

import ClientSocketManager from './ClientSocketManager';
import ClientGameManagerState from '../models/ClientGameManagerState';
import { SocketMessage, RequestInitialDataMessage } from '../models/SocketMessage';
import { StoreData } from '../reducers/root';
import { gameActions } from '../reducers/Game';
import GameState from '../models/GameState';
import { GameObject } from '../models/Game';

export default class ClientGameManager {
	private _state = ClientGameManagerState.Disconnected;
	
	private _dispatch: Dispatch<StoreData>;

	constructor(dispatch: Dispatch<StoreData>) {
		this._dispatch = dispatch;
		
		ClientSocketManager.onConnect.subscribe(this._handleConnect);
		ClientSocketManager.onDisconnect.subscribe(this._handleDisconnect);
		ClientSocketManager.onMessage.subscribe(this._handleMessage);
	}
	
	public connect() {
		if (this._state === ClientGameManagerState.Disconnected) {
			this._changeState(ClientGameManagerState.Connecting);
			
			ClientSocketManager.connect();
		}
	}
	
	public disconnect() {
		this._changeState(ClientGameManagerState.Disconnected);

		ClientSocketManager.disconnect();
	}
	
	private _handleConnect = () => {
		(async () => {
			this._changeState(ClientGameManagerState.WaitingForInitialData);
		
			console.log('Got connected! Now we need to fetch initial data.');
			
			try {
				// Send initial data fetch request. _handleMessage will get the rest.
				// Expect a response for the sake of timeout error handling.
				ClientSocketManager.send({ type: 'RequestInitialDataMessage' } as RequestInitialDataMessage);
				await ClientSocketManager.expectMessageOfType('InitialDataResponseMessage');
			} catch (error) {
				console.log(error);
			}
		})();
	}
	
	private _restoreGame(gameState: GameState, _data: GameObject) {
		let gameManagerState = ClientGameManagerState.JoinGame;
		
		// TODO: Unload data.
		
		// TODO: Set to proper state.
		switch (gameState) {
		case GameState.WaitingForPlayers:
			gameManagerState = ClientGameManagerState.InGameLobby;
			break;
		
		case GameState.WaitingForPlayerDescriptions:
			// TODO: Look at data to determine if we need to enter name, draw
			// picture, or neither.
			gameManagerState = ClientGameManagerState.WaitingForGameToBegin;
			break;
			
		case GameState.WaitingForTextSubmissions:
			// TODO: Look at game data to determine if we've already submitted text.
			gameManagerState = ClientGameManagerState.WaitingForOthersToEnterText;
			break;
			
		case GameState.WaitingForPictureSubmissions:
			// TODO: Look at game data to determine if we've already submitted a picture.
			gameManagerState = ClientGameManagerState.WaitingForOthersToDrawPicture;
			break;
			
		case GameState.ReviewingStories:
			gameManagerState = ClientGameManagerState.ReviewingSequences;
			break;

		case GameState.PlayAgainOptions:
			gameManagerState = ClientGameManagerState.PlayAgainOptions;
			break;
		}
					
		this._changeState(gameManagerState);
	}
	
	private _handleDisconnect = () => {
		if (this._state !== ClientGameManagerState.Disconnected) {
			this._changeState(ClientGameManagerState.Connecting);
		}
	}
	
	private _handleMessage = (message: SocketMessage) => {
		if (message.type === 'InitialDataResponseMessage') {
			// Unload the game state data.
			if (!message.data.game) {
				this._changeState(ClientGameManagerState.JoinGame);
			} else {
				this._restoreGame(message.data.game.state, message.data.game);
			}
		}
	}
	
	private _changeState(state: ClientGameManagerState) {
		this._state = state;
		this._dispatch(gameActions.changeState(state));
	}
}
