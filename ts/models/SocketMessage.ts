import { GameObject } from './Game';

interface SocketMessageTemplate<T, D> {
	type: T;
	data: D;
}

export type AuthenticateSocketMessage = SocketMessageTemplate<'AuthenticateSocketMessage', string>;
export type AuthenticateResponseSocketMessage = SocketMessageTemplate<'AuthenticateResponseSocketMessage', {
	success: boolean;
	error?: string;
}>;

export type RequestInitialDataMessage = SocketMessageTemplate<'RequestInitialDataMessage', string>;
export type InitialDataResponseMessage = SocketMessageTemplate<'InitialDataResponseMessage', {
	game?: GameObject;
}>;

export type CreateGameMessage = SocketMessageTemplate<'CreateGameMessage', string>;
export type GameCreatedMessage = SocketMessageTemplate<'GameCreatedMessage', {
	game: GameObject
}>;

export type SocketMessage =
	AuthenticateSocketMessage |
	AuthenticateResponseSocketMessage |
	RequestInitialDataMessage |
	InitialDataResponseMessage |
	CreateGameMessage |
	GameCreatedMessage;
