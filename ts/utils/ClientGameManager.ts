// ClientGameManager.ts
//
// ClientGameManager serves two purposes. First, it's an abstraction over
// the low level ClientSocketManager. Second, it controls the state of the
// game and keeps it in sync with the server.

import { Dispatch } from 'react-redux';

import ClientSocketManager from './ClientSocketManager';
import { SocketMessage, RequestInitialDataMessage, CreateGameMessage, JoinGameMessage } from '../models/SocketMessage';
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
		ClientSocketManager.send({ type: 'CreateGameMessage' } as CreateGameMessage);
		await ClientSocketManager.expectMessageOfType('GameCreatedMessage');
	}
	
	public async joinGame(code: string) {
		// Call to join a game. Expect a response for the sake of error handling.
		ClientSocketManager.send({ type: 'JoinGameMessage', data: { code } } as JoinGameMessage);
		await ClientSocketManager.expectMessageOfType('GameJoinedMessage');
	}
	
	private _handleConnect = () => {
		(async () => {
			// Note that we've connected, but haven't yet gotten initial data.
			this._dispatch(gameActions.connect());
			
			// Send initial data fetch request. _handleMessage will get the rest.
			// Expect a response for the sake of timeout error handling.
			ClientSocketManager.send({ type: 'RequestInitialDataMessage' } as RequestInitialDataMessage);
			await ClientSocketManager.expectMessageOfType('InitialDataResponseMessage');
		})();
	}
	
	private _handleDisconnect = () => {
		this._dispatch(gameActions.disconnect());
	}
	
	private _handleMessage = (message: SocketMessage) => {
		if (message.type === 'InitialDataResponseMessage') {
			this._dispatch(gameActions.loadGame(message.data.game));
		} else if (message.type === 'GameCreatedMessage') {
			this._dispatch(gameActions.loadGame(message.data.game));
		} else if (message.type === 'GameJoinedMessage') {
			if (message.data.error) {
				this._dispatch(gameActions.gameJoinError(message.data.error));
			} else if (message.data.game) {
				this._dispatch(gameActions.loadGame(message.data.game));
			}
		} else if (message.type === 'PlayerAddedMessage') {
			this._dispatch(gameActions.addPlayer(message.data.player));
		} else if (message.type === 'PlayerUpdatedMessage') {
			this._dispatch(gameActions.updatePlayer(message.data.player));
		} else if (message.type === 'PlayerRemovedMessage') {
			this._dispatch(gameActions.removePlayer(message.data.player));
		}
	}
}
