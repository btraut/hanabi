import { combineReducers } from 'redux';
import { createAction, getType } from 'typesafe-actions';
import { GameData } from '../models/Game';

const prefix = (p: string) => `Game/${p}`;

export const gameActions = {
	connect: createAction(
		prefix('CONNECT'),
		() => ({ type: prefix('CONNECT') })
	),
	disconnect: createAction(
		prefix('DISCONNECT'),
		() => ({ type: prefix('DISCONNECT') })
	),
	restoreGame: createAction(
		prefix('RESTORE_GAME'),
		(gameData?: GameData) => ({ type: prefix('RESTORE_GAME'), gameData })
	)
};

export interface GameState {
	readonly connected: boolean;
	readonly gameData: GameData | null;
}

export const initialState: GameState = {
	connected: false,
	gameData: null
};

export const gameReducer = combineReducers<GameState>({
	connected: (connected = false, action) => {
		switch (action.type) {
			case getType(gameActions.connect): return true;
			case getType(gameActions.disconnect): return false;
			default: return connected;
		}
	},
	gameData: (gameData: GameData | null = null, action) => {
		switch (action.type) {
			case getType(gameActions.restoreGame): return action.gameData || null;
			default: return gameData;
		}
	}
});
