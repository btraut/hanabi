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
}

export const clientSocketConnectionReducer = combineReducers<ClientSocketConnectionState>({
	isConnected: (state = false, action) => {
		switch (action.type) {
			case getType(clientSocketConnectionActions.connected): return state;
		}
		
		return state;
	}
});
