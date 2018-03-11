import { GameData, GameState as GameDataState, ConnectionState } from '../models/Game';
import { TypedModel } from './types';

export interface WordArtState {
	// Connection states:
	readonly connectionState: ConnectionState;
	
	// The current user's user id:
	readonly userId: string | null;
	
	// Current game:
	readonly gameData: GameData | null;
	
	// Error messages during setup and gameplay:
	readonly joinGameError: string | null;
	readonly startGameError: string | null;
	readonly addPlayerError: string | null;
	readonly updateUserError: string | null;
	readonly setPlayerNameError: string | null;
	readonly setPlayerPictureError: string | null;
	readonly enterPhraseError: string | null;
	readonly enterPictureError: string | null;
	readonly setGameStateError: string | null;
	readonly reviewingFinishedError: string | null;
	readonly startOverError: string | null;
	readonly endGameError: string | null;
}

const connectionStateModel: TypedModel<ConnectionState> = {
	state: ConnectionState.Disconnected,
	reducers: {
		connect: () => ConnectionState.LoadingInitialData,
		loadedInitialData: () => ConnectionState.Connected,
		disconnect: () => ConnectionState.Disconnected
	}
};

const gameDataModel: TypedModel<GameData | null> = {
	state: null,
	reducers: {
		load: (_, gameData) => gameData || null,
		addPlayer: (state, payload) => {
			if (!state || state.code !== payload.gameCode) {
				return state;
			}
			
			const newPlayers = [...state.players.filter(p => p.id !== payload.player.id), payload.player];
			return { ...state, players: newPlayers };
		},
		updateUser: (state, payload) => {
			if (!state || state.code !== payload.gameCode) {
				return state;
			}
			
			if (state.host.id === payload.player.id) {
				return { ...state, host: payload.player };
			}
			
			const newPlayers = [...state.players.filter(p => p.id !== payload.player.id), payload.player];
			return { ...state, players: newPlayers };
		},
		gameStarted: (state, payload) => {
			if (!state || state.code !== payload.gameCode) {
				return state;
			}
			
			// Clone all players, adding player order.
			const players = [];
			for (const player of state.players) {
				players.push({
					...player,
					order: payload.playerOrders.indexOf(player.id)
				});
			}
			
			// Add the new state and players list into game data.
			return {
				...state,
				state: GameDataState.WaitingForPhraseSubmissions,
				players
			};
		},
		setPlayerName: (state, payload) => {
			// Verify we're updating this game.
			if (!state || state.code !== payload.gameCode) {
				return state;
			}
			
			// Grab the existing player entry.
			const oldPlayer = state.players.find(p => p.id === payload.playerId);
			if (!oldPlayer) {
				throw new Error('Player doesn’t exist in this game.');
			}
			
			// Create a new player obj, add it to a new player list, and add that
			// player list into a new state obj.
			const newPlayer = { ...oldPlayer, name: payload.name };
			const newPlayers = [...state.players.filter(p => p.id !== payload.playerId), newPlayer];
			return { ...state, players: newPlayers };
		},
		setPlayerPicture: (state, payload) => {
			// Verify we're updating this game.
			if (!state || state.code !== payload.gameCode) {
				return state;
			}
			
			// Grab the existing player entry.
			const oldPlayer = state.players.find(p => p.id === payload.playerId);
			if (!oldPlayer) {
				throw new Error('Player doesn’t exist in this game.');
			}
			
			// Create a new player obj, add it to a new player list, and add that
			// player list into a new state obj.
			const newPlayer = { ...oldPlayer, pictureData: payload.pictureData };
			const newPlayers = [...state.players.filter(p => p.id !== payload.playerId), newPlayer];
			return { ...state, players: newPlayers };
		},
		setGameState: (state, payload) => {
			// Verify we're updating this game.
			if (!state || state.code !== payload.gameCode) {
				return state;
			}
			
			// Copy game state and round to data.
			return {
				...state,
				state: typeof payload.state !== 'undefined' ? payload.state : state.state,
				currentRound: typeof payload.state !== 'undefined' ? payload.currentRound : state.currentRound
			};
		},
		enterPhrase: (state, payload) => {
			// Verify we're updating this game.
			if (!state || state.code !== payload.gameCode) {
				return state;
			}
			
			// Update phrases.
			const phrases = [...state.phrases];
			const index = state.currentRound / 2;
			if (!phrases[index]) {
				phrases[index] = {};
			}
			
			phrases[index][payload.playerId] = payload.phrase;
			
			return { ...state, phrases };
		},
		enterPicture: (state, payload) => {
			// Verify we're updating this game.
			if (!state || state.code !== payload.gameCode) {
				return state;
			}
			
			// Update pictures.
			const index = (state.currentRound - 1) / 2;
			const pictures = [...state.pictures];
			if (!pictures[index]) {
				pictures[index] = {};
			}
			
			pictures[index][payload.playerId] = payload.pictureData;
			
			return { ...state, pictures };
		},
		reviewingFinished: (state, payload) => {
			// Verify we're updating this game.
			if (!state || state.code !== payload.gameCode) {
				return state;
			}
			
			// Update game state.
			return { ...state, state: GameDataState.PlayAgainOptions };
		},
		startOver: (state, payload) => {
			// Verify we're updating this game.
			if (!state || state.code !== payload.gameCode) {
				return state;
			}
			
			// Replace the game data with that of the action's.
			return payload.state;
		},
		endGame: (state, payload) => {
			// Verify we're updating this game.
			if (!state || state.code !== payload.gameCode) {
				return state;
			}
			
			// Trash the current game.
			return null;
		}
	}
};

const userIdModel: TypedModel<string | null> = {
	state: null,
	reducers: {
		set: (_, userId) => userId || null,
		clear: () => null
	}
};

const errorModel: TypedModel<string | null> = {
	state: null,
	reducers: {
		set: (_: never, errorText: string | null) => errorText,
		clear: () => null
	}
};

export const models = {
	connectionState: connectionStateModel,
	gameData: gameDataModel,
	userId: userIdModel,
	joinGameError: { ...errorModel },
	startGameError: { ...errorModel },
	addPlayerError: { ...errorModel },
	updateUserError: { ...errorModel },
	setPlayerNameError: { ...errorModel },
	setPlayerPictureError: { ...errorModel },
	enterPhraseError: { ...errorModel },
	enterPictureError: { ...errorModel },
	setGameStateError: { ...errorModel },
	reviewingFinishedError: { ...errorModel },
	startOverError: { ...errorModel },
	endGameError: { ...errorModel }
};
