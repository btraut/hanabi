// ClientSocketConnectionManager.ts
//
// The purpose of this class is to abstract away some of the complexities
// of the lower-level ClientSocketManager and also surface status to
// redux.
//
// It is intended that a new ClientSocketConnectionManager is made for
// each redux store, and as such, should probably be built into the React
// DOM as a provider/withHOC pattern.

import { Dispatch } from 'react-redux';

import ClientSocketManager from './ClientSocketManager';
import { StoreData } from '../reducers/root';
import { clientSocketConnectionActions } from '../reducers/ClientSocketConnection';
import PubSub from './PubSub';
import { SocketMessage } from '../models/SocketMessage';

export default class ClientSocketConnectionManager {
	private _isConnected = false;
	public get isConnected() { return this._isConnected; }
	
	private _dispatch: Dispatch<StoreData>;
	
	constructor(dispatch: Dispatch<StoreData>) {
		this._dispatch = dispatch;
		
		ClientSocketManager.onConnect.subscribe(this._handleConnect);
		ClientSocketManager.onDisconnect.subscribe(this._handleDisconnect);
		ClientSocketManager.onMessage.subscribe(this._handleMessage);
	}

	private _onConnect = new PubSub<void>();
	private _onDisconnect = new PubSub<void>();
	private _onMessage = new PubSub<SocketMessage>();
	
	public get onConnect() { return this._onConnect; }
	public get onDisconnect() { return this._onDisconnect; }
	public get onMessage() { return this._onMessage; }

	public connect() {
		if (this._isConnected) {
			return;
		}
		
		// Notify redux that we're connecting.
		this._dispatch(clientSocketConnectionActions.connecting());
		
		ClientSocketManager.connect();
	}
	
	public disconnect() {
		// Notify redux that we're disconnecting.
		this._dispatch(clientSocketConnectionActions.disconnecting());

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
		this._isConnected = true;
		
		// Notify redux that we've connected.
		this._dispatch(clientSocketConnectionActions.connected());
	}
	
	private _handleDisconnect = () => {
		this._isConnected = false;
		
		// Notify redux that we've disconnected.
		this._dispatch(clientSocketConnectionActions.disconnected());
	}
	
	private _handleMessage = (message: SocketMessage) => {
		this._onMessage.emit(message);
	}
}
