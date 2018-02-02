import { combineReducers } from 'redux';
import { createAction, getType } from 'typesafe-actions';

export const clientSocketConnectionActions = {
	connecting: createAction('CONNECTING'),
	connected: createAction('CONNECTED'),
	disconnecting: createAction('DISCONNECTING'),
	disconnected: createAction('DISCONNECTED')
};

export enum ConnectionState {
	Connecting,
	Connected,
	Disconnecting,
	Disconnected
}

export interface ClientSocketConnectionState {
	readonly connectionState: ConnectionState;
}

export interface RootState {
	clientSocketConnection: ClientSocketConnectionState;
}

export const initialState: RootState = {
	clientSocketConnection: {
		connectionState: ConnectionState.Disconnected
	}
};

export const clientSocketConnectionReducer = combineReducers<ClientSocketConnectionState>({
	connectionState: (state = ConnectionState.Disconnected, action) => {
		switch (action.type) {
			case getType(clientSocketConnectionActions.connecting): return ConnectionState.Connecting;
			case getType(clientSocketConnectionActions.connected): return ConnectionState.Connected;
			case getType(clientSocketConnectionActions.disconnecting): return ConnectionState.Disconnecting;
			case getType(clientSocketConnectionActions.disconnected): return ConnectionState.Disconnected;
			default: return state;
		}
	}
});
