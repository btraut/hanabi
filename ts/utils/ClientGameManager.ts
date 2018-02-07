// ClientGameManager.ts
//
// ClientGameManager serves two purposes. First, it's an abstraction over
// the low level ClientSocketManager. Second, it controls the state of the
// game and keeps it in sync with the server.

import { Dispatch } from 'react-redux';

import ClientSocketManager from './ClientSocketManager';
import { SocketMessage, RequestInitialDataMessage } from '../models/SocketMessage';
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
	
	private _handleConnect = () => {
		(async () => {
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
			this._dispatch(gameActions.restoreGame(message.data.game));
			this._dispatch(gameActions.connect());
		}
	}
}
