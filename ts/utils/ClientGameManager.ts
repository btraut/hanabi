// ClientGameManager.ts
//
// ClientGameManager serves two purposes. First, it's an abstraction over
// SclientSocketConnectionManger (and in turn, ClientSocketManager).
// Second, it controls the state of the game and keeps it in sync with
// the server.

import { Dispatch } from 'react-redux';

import ClientSocketConnectionManager from './ClientSocketConnectionManager';
import ClientGameManagerState from '../models/ClientGameManagerState';
import { SocketMessage } from '../models/SocketMessage';
import { StoreData } from '../reducers/root';
import { gameActions } from '../reducers/Game';

export default class ClientGameManager {
	private _socketConnectionManager: ClientSocketConnectionManager;
	private _state = ClientGameManagerState.Disconnected;
	
	private _dispatch: Dispatch<StoreData>;

	constructor(dispatch: Dispatch<StoreData>) {
		this._dispatch = dispatch;
		
		this._socketConnectionManager = new ClientSocketConnectionManager(dispatch);
		
		this._socketConnectionManager.onConnect.subscribe(this._handleConnect);
		this._socketConnectionManager.onDisconnect.subscribe(this._handleDisconnect);
		this._socketConnectionManager.onMessage.subscribe(this._handleMessage);
	}
	
	public connect() {
		if (this._state === ClientGameManagerState.Disconnected) {
			this._state = ClientGameManagerState.Connecting;
			this._dispatch(gameActions.changeState(ClientGameManagerState.Connecting));
			
			this._socketConnectionManager.connect();
		}
	}
	
	public disconnect() {
		this._state = ClientGameManagerState.Disconnected;
		this._dispatch(gameActions.changeState(ClientGameManagerState.Disconnected));

		this._socketConnectionManager.disconnect();
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
