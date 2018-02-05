import { combineReducers } from 'redux';

import {
	initialState as clientSocketConnectionInitialState,
	ClientSocketConnectionState,
	clientSocketConnectionReducer
} from './ClientSocketConnection';
import {
	initialState as gameInitialState,
	GameState,
	gameReducer
} from './Game';

// Combine all state types.
export interface StoreData {
	clientSocketConnection: ClientSocketConnectionState;
	game: GameState;
};

// Combine all initial state data.
export const initialState: StoreData = {
	clientSocketConnection: clientSocketConnectionInitialState,
	game: gameInitialState
};

// Combine all reducers.
export const reducer = combineReducers<StoreData>({
	clientSocketConnection: clientSocketConnectionReducer,
	game: gameReducer
});
