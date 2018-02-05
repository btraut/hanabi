import { combineReducers } from 'redux';

import {
	initialState as gameInitialState,
	GameState,
	gameReducer
} from './Game';

// Combine all state types.
export interface StoreData {
	game: GameState;
};

// Combine all initial state data.
export const initialState: StoreData = {
	game: gameInitialState
};

// Combine all reducers.
export const reducer = combineReducers<StoreData>({
	game: gameReducer
});
