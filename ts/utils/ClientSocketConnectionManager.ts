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

export default class ClientSocketConnectionManager {
	private _isConnected = false;
	public get isConnected() { return this._isConnected; }
	
	private _dispatch: Dispatch<StoreData>;
	
	constructor(dispatch: Dispatch<StoreData>) {
		this._dispatch = dispatch;
		
		ClientSocketManager.onConnect.subscribe(this._handleConnected);
		ClientSocketManager.onDisconnect.subscribe(this._handleDisconnected);
	}
	
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
	
	private _handleConnected = () => {
		this._isConnected = true;
		
		// Notify redux that we've connected.
		this._dispatch(clientSocketConnectionActions.connected());
	}
	
	private _handleDisconnected = () => {
		this._isConnected = false;
		
		// Notify redux that we've disconnected.
		this._dispatch(clientSocketConnectionActions.disconnected());
	}
}
