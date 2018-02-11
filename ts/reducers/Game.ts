import { combineReducers } from 'redux';
import { createAction, getType } from 'typesafe-actions';
import { GameData } from '../models/Game';
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
	gameJoinError: createAction(
		prefix('GAME_JOIN_ERROR'),
		(errorText: string) => ({ type: prefix('GAME_JOIN_ERROR'), errorText })
	),
	addPlayer: createAction(
		prefix('ADD_PLAYER'),
		(player: Player) => ({ type: prefix('ADD_PLAYER'), player })
	),
	updateUser: createAction(
		prefix('UPDATE_USER'),
		(player: Player) => ({ type: prefix('UPDATE_USER'), player })
	),
	removePlayer: createAction(
		prefix('REMOVE_PLAYER'),
		(player: Player) => ({ type: prefix('REMOVE_PLAYER'), player })
	)
};

export interface GameState {
	readonly connected: boolean;
	readonly initialDataLoaded: boolean;
	readonly gameData: GameData | null;
	readonly joinGameError: string | null;
}

export const initialState: GameState = {
	connected: false,
	initialDataLoaded: false,
	gameData: null,
	joinGameError: null
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
				if (!gameData) {
					return gameData;
				}
				
				const newPlayers = [...gameData.players.filter(player => player.id !== action.player.id), action.player];
				return { ...gameData, players: newPlayers };
			}

			case getType(gameActions.updateUser):
			{
				if (!gameData) {
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
				if (!gameData) {
					return gameData;
				}
				
				const newPlayers = [...gameData.players.filter(player => player.id !== action.player.id)];
				return { ...gameData, players: newPlayers };
			}
		
			default:
				return gameData;
		}
	},
	joinGameError: (errorText: string | null = null, action) => {
		switch (action.type) {
			case getType(gameActions.gameJoinError): return action.errorText;
			default: return errorText;
		}
	}
});
