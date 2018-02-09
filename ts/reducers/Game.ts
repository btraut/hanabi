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
	loadGame: createAction(
		prefix('LOAD_GAME'),
		(gameData?: GameData) => ({ type: prefix('LOAD_GAME'), gameData })
	)
};

export interface GameState {
	readonly connected: boolean;
	readonly initialDataLoaded: boolean;
	readonly gameData: GameData | null;
}

export const initialState: GameState = {
	connected: false,
	initialDataLoaded: false,
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
	initialDataLoaded: (initialDataLoaded = false, action) => {
		switch (action.type) {
			case getType(gameActions.disconnect): return false;
			case getType(gameActions.loadGame): return true;
			default: return initialDataLoaded;
		}
	},
	gameData: (gameData: GameData | null = null, action) => {
		switch (action.type) {
			case getType(gameActions.loadGame): return action.gameData || null;
			default: return gameData;
		}
	}
});
