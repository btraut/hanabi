import { GameData } from './Game';
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

export type PlayerAddedMessage = SocketMessageTemplate<'PlayerAddedMessage', { gameCode: string, player: Player; }>;
export type UserUpdatedMessage = SocketMessageTemplate<'UserUpdatedMessage', { gameCode: string, player: Player; }>;
export type PlayerRemovedMessage = SocketMessageTemplate<'PlayerRemovedMessage', { gameCode: string, player: Player; }>;

export type StartGameMessage = SocketMessageTemplate<'StartGameMessage', { gameCode: string }>;
export type GameStartedMessage = SocketMessageTemplate<'GameStartedMessage', {
	error?: string;
	gameCode?: string
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
	UserUpdatedMessage |
	PlayerRemovedMessage |
	StartGameMessage |
	GameStartedMessage;
