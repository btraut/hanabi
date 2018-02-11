import { combineReducers } from 'redux';
import { createAction, getType } from 'typesafe-actions';
import { GameData, GameState as GameDataState } from '../models/Game';
import Player from '../models/Player';

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
	),
	joinGameError: createAction(
		prefix('JOIN_GAME_ERROR'),
		(errorText: string) => ({ type: prefix('JOIN_GAME_ERROR'), errorText })
	),
	addPlayer: createAction(
		prefix('ADD_PLAYER'),
		(player: Player, gameCode: string) => ({ type: prefix('ADD_PLAYER'), player, gameCode })
	),
	updateUser: createAction(
		prefix('UPDATE_USER'),
		(player: Player, gameCode: string) => ({ type: prefix('UPDATE_USER'), player, gameCode })
	),
	removePlayer: createAction(
		prefix('REMOVE_PLAYER'),
		(player: Player, gameCode: string) => ({ type: prefix('REMOVE_PLAYER'), player, gameCode })
	),
	gameStarted: createAction(
		prefix('GAME_STARTED'),
		(gameCode: string) => ({ type: prefix('GAME_STARTED'), gameCode })
	),
	startGameError: createAction(
		prefix('START_GAME_ERROR'),
		(errorText: string) => ({ type: prefix('START_GAME_ERROR'), errorText })
	),
	clearErrors: createAction(
		prefix('CLEAR_ERRORS'),
		() => ({ type: prefix('CLEAR_ERRORS') })
	)
};

export interface GameState {
	readonly connected: boolean;
	readonly initialDataLoaded: boolean;
	readonly gameData: GameData | null;
	readonly joinGameError: string | null;
	readonly startGameError: string | null;
}

export const initialState: GameState = {
	connected: false,
	initialDataLoaded: false,
	gameData: null,
	joinGameError: null,
	startGameError: null
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
			case getType(gameActions.loadGame):
				return action.gameData || null;
			
			case getType(gameActions.addPlayer):
			{
				if (!gameData || gameData.code !== action.gameCode) {
					return gameData;
				}
				
				const newPlayers = [...gameData.players.filter(player => player.id !== action.player.id), action.player];
				return { ...gameData, players: newPlayers };
			}

			case getType(gameActions.updateUser):
			{
				if (!gameData || gameData.code !== action.gameCode) {
					return gameData;
				}
				
				if (gameData.host.id === action.player.id) {
					return { ...gameData, host: action.player };
				}
				
				const newPlayers = [...gameData.players.filter(player => player.id !== action.player.id), action.player];
				return { ...gameData, players: newPlayers };
			}

			case getType(gameActions.removePlayer):
			{
				if (!gameData || gameData.code !== action.gameCode) {
					return gameData;
				}
				
				const newPlayers = [...gameData.players.filter(player => player.id !== action.player.id)];
				return { ...gameData, players: newPlayers };
			}
		
			case getType(gameActions.gameStarted):
			{
				if (!gameData || gameData.code !== action.gameCode) {
					return gameData;
				}
				
				return { ...gameData, state: GameDataState.WaitingForPlayerDescriptions };
			}
		
			default:
				return gameData;
		}
	},
	joinGameError: (errorText: string | null = null, action) => {
		switch (action.type) {
			case getType(gameActions.joinGameError): return action.errorText;
			case getType(gameActions.clearErrors): return null;
			case getType(gameActions.connect): return null;
			default: return errorText;
		}
	},
	startGameError: (errorText: string | null = null, action) => {
		switch (action.type) {
			case getType(gameActions.startGameError): return action.errorText;
			case getType(gameActions.clearErrors): return null;
			case getType(gameActions.connect): return null;
			default: return errorText;
		}
	}
});
