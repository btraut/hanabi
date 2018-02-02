import { combineReducers } from 'redux';

import {
	RootState as ClientSocketConnectionRootState,
	initialState as clientSocketConnectionInitialState,
	clientSocketConnectionReducer
} from './ClientSocketConnection';

// Combine all state types.
export type StoreData = ClientSocketConnectionRootState;

// Combine all initial state data.
export const initialState: StoreData = {
	...clientSocketConnectionInitialState
};

// Combine all reducers.
export const reducer = combineReducers<StoreData>({
	clientSocketConnectionReducer
});
