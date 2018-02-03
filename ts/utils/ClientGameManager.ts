import { Dispatch } from 'react-redux';

import ClientSocketConnectionManager from './ClientSocketConnectionManager';
import { SocketMessage } from '../models/SocketMessage';
import { StoreData } from '../reducers/root';

export enum ClientGameManagerState {
	Disconnected,
	Connecting,
	WaitingForInitialData,
	InGameLobby,
	NameYourself,
	DrawYourself,
	WaitingForNextPhase,
	EnterText,
	WaitingForOthersToEnterText,
	DrawPicture,
	WaitingForOthersToDrawPicture,
	ReviewingSequences
}

export default class ClientGameManager {
	private _socketConnectionManager: ClientSocketConnectionManager;
	private _state = ClientGameManagerState.Disconnected;
	
	constructor(dispatch: Dispatch<StoreData>) {
		this._socketConnectionManager = new ClientSocketConnectionManager(dispatch);
		
		this._socketConnectionManager.onConnect.subscribe(this._handleConnect);
		this._socketConnectionManager.onDisconnect.subscribe(this._handleDisconnect);
		this._socketConnectionManager.onMessage.subscribe(this._handleMessage);
	}
	
	public connect() {
		if (this._state === ClientGameManagerState.Disconnected) {
			this._state = ClientGameManagerState.Connecting;
			this._socketConnectionManager.connect();
		}
	}
	
	public disconnect() {
		this._state = ClientGameManagerState.Disconnected;
		this._socketConnectionManager.disconnect();
	}
	
	private _handleConnect() {
		(async () => {
			// Send initial data fetch request.
			
			// Expect initial data fetch response.
			
			console.log('If we got here, it means we fetched initial data from server!');
		})();
	}
	
	private _handleDisconnect() {
		if (this._state !== ClientGameManagerState.Disconnected) {
			this._state = ClientGameManagerState.Connecting;
		}
	}
	
	private _handleMessage(_message: SocketMessage) {
		// TODO
	}
}
