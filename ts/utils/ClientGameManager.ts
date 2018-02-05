// ClientGameManager.ts
//
// ClientGameManager serves two purposes. First, it's an abstraction over
// the low level ClientSocketManager. Second, it controls the state of the
// game and keeps it in sync with the server.

import { Dispatch } from 'react-redux';

import ClientSocketManager from './ClientSocketManager';
import ClientGameManagerState from '../models/ClientGameManagerState';
import { SocketMessage } from '../models/SocketMessage';
import { StoreData } from '../reducers/root';
import { gameActions } from '../reducers/Game';

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
			this._state = ClientGameManagerState.Connecting;
			this._dispatch(gameActions.changeState(ClientGameManagerState.Connecting));
			
			ClientSocketManager.connect();
		}
	}
	
	public disconnect() {
		this._state = ClientGameManagerState.Disconnected;
		this._dispatch(gameActions.changeState(ClientGameManagerState.Disconnected));

		ClientSocketManager.disconnect();
	}
	
	public send(message: SocketMessage) {
		// Pass through to ClientSocketManager.
		return ClientSocketManager.send(message);
	}
	
	public async expect(isCorrectMessage: (message: SocketMessage) => boolean): Promise<SocketMessage> {
		// Pass through to ClientSocketManager.
		return ClientSocketManager.expect(isCorrectMessage);
	}
	
	private _handleConnect = () => {
		(async () => {
			// Send initial data fetch request.
			
			// Expect initial data fetch response.
			
			console.log('If we got here, it means we fetched initial data from server!');
			this._state = ClientGameManagerState.InGameLobby;
			this._dispatch(gameActions.changeState(ClientGameManagerState.InGameLobby));
		})();
	}
	
	private _handleDisconnect = () => {
		if (this._state !== ClientGameManagerState.Disconnected) {
			this._state = ClientGameManagerState.Connecting;
			this._dispatch(gameActions.changeState(ClientGameManagerState.Connecting));
		}
	}
	
	private _handleMessage = (_message: SocketMessage) => {
		// TODO
	}
}
