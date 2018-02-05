import { combineReducers } from 'redux';
import { createAction, getType } from 'typesafe-actions';
import ClientGameManagerState from '../models/ClientGameManagerState';

const prefix = (p: string) => `Game/${p}`;

export const gameActions = {
	changeState: createAction(
		prefix('CHANGE_STATE'),
		(state: ClientGameManagerState) => ({ type: prefix('CHANGE_STATE'), state })
	)
};

export interface GameState {
	readonly state: ClientGameManagerState;
}

export const initialState: GameState = {
	state: ClientGameManagerState.Disconnected
};

export const gameReducer = combineReducers<GameState>({
	state: (state = ClientGameManagerState.Disconnected, action) => {
		switch (action.type) {
			case getType(gameActions.changeState): return action.state;
			default: return state;
		}
	}
});
