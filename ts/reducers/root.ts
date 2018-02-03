import { combineReducers } from 'redux';

import {
	initialState as clientSocketConnectionInitialState,
	ClientSocketConnectionState,
	clientSocketConnectionReducer
} from './ClientSocketConnection';

// Combine all state types.
export interface StoreData {
	clientSocketConnection: ClientSocketConnectionState;
};

// Combine all initial state data.
export const initialState: StoreData = {
	clientSocketConnection: clientSocketConnectionInitialState
};

// Combine all reducers.
export const reducer = combineReducers<StoreData>({
	clientSocketConnection: clientSocketConnectionReducer
});
