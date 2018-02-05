import { combineReducers } from 'redux';
import { createAction, getType } from 'typesafe-actions';

import ConnectionState from '../models/ConnectionState';

const prefix = (p: string) => `ClientSocketConnection/${p}`;

export const clientSocketConnectionActions = {
	changeConnectionState: createAction(
		prefix('CHANGE_CONNECTION_STATE'),
		(state: ConnectionState) => ({ type: prefix('CHANGE_CONNECTION_STATE'), state })
	)
};

export interface ClientSocketConnectionState {
	readonly connectionState: ConnectionState;
}

export const initialState: ClientSocketConnectionState = {
	connectionState: ConnectionState.Disconnected
};

export const clientSocketConnectionReducer = combineReducers<ClientSocketConnectionState>({
	connectionState: (state = ConnectionState.Disconnected, action) => {
		switch (action.type) {
			case getType(clientSocketConnectionActions.changeConnectionState): return action.state;
			default: return state;
		}
	}
});
