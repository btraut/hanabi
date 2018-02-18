import { GameData, GameState } from './Game';
import Player from './Player';

interface SocketMessageTemplate<T, D> {
	type: T;
	data: D;
}

export type AuthenticateSocketMessage = SocketMessageTemplate<'AuthenticateSocketMessage', string>;
export type AuthenticateResponseSocketMessage = SocketMessageTemplate<'AuthenticateResponseSocketMessage', { error?: string; }>;

export type RequestInitialDataMessage = SocketMessageTemplate<'RequestInitialDataMessage', void>;
export type InitialDataResponseMessage = SocketMessageTemplate<'InitialDataResponseMessage', {
	error?: string;
	game?: GameData;
	userId?: string;
}>;

export type CreateGameMessage = SocketMessageTemplate<'CreateGameMessage', void>;
export type GameCreatedMessage = SocketMessageTemplate<'GameCreatedMessage', {
	error?: string;
	game?: GameData;
}>;

export type JoinGameMessage = SocketMessageTemplate<'JoinGameMessage', { gameCode: string; }>;
export type GameJoinedMessage = SocketMessageTemplate<'GameJoinedMessage', {
	error?: string;
	game?: GameData;
}>;

export type PlayerAddedMessage = SocketMessageTemplate<'PlayerAddedMessage', {
	gameCode?: string;
	player?: Player;
	error?: string;
}>;
export type PlayerRemovedMessage = SocketMessageTemplate<'PlayerRemovedMessage', {
	gameCode?: string;
	player?: Player;
	error?: string;
}>;
export type UserUpdatedMessage = SocketMessageTemplate<'UserUpdatedMessage', {
	gameCode?: string;
	player?: Player;
	error?: string;
}>;

export type StartGameMessage = SocketMessageTemplate<'StartGameMessage', { gameCode: string }>;
export type GameStartedMessage = SocketMessageTemplate<'GameStartedMessage', {
	error?: string;
	gameCode?: string;
}>;

export type SetPlayerNameMessage = SocketMessageTemplate<'SetPlayerNameMessage', {
	gameCode: string;
	name: string;
}>;
export type PlayerNameSetMessage = SocketMessageTemplate<'PlayerNameSetMessage', {
	error?: string;
	gameCode?: string;
	playerId?: string;
	name?: string;
}>;

export type SetGameStateMessage = SocketMessageTemplate<'SetGameStateMessage', {
	gameState: GameState;
	gameCode: string;
}>;

export type SetPlayerPictureMessage = SocketMessageTemplate<'SetPlayerPictureMessage', {
	gameCode: string;
	pictureData: string;
}>;
export type PlayerPictureSetMessage = SocketMessageTemplate<'PlayerPictureSetMessage', {
	error?: string;
	gameCode?: string;
	playerId?: string;
	pictureData?: string;
}>;

export type SocketMessage =
	AuthenticateSocketMessage |
	AuthenticateResponseSocketMessage |
	RequestInitialDataMessage |
	InitialDataResponseMessage |
	CreateGameMessage |
	GameCreatedMessage |
	JoinGameMessage |
	GameJoinedMessage |
	PlayerAddedMessage |
	PlayerRemovedMessage |
	UserUpdatedMessage |
	StartGameMessage |
	GameStartedMessage |
	SetPlayerNameMessage |
	PlayerNameSetMessage |
	SetPlayerPictureMessage |
	PlayerPictureSetMessage |
	SetGameStateMessage;
