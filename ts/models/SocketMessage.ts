import GameState from './GameState';

interface SocketMessageTemplate<T, D> {
	type: T;
	data: D;
}

export type LogSocketMessage = SocketMessageTemplate<'LogSocketMessage', string>;
export type AuthenticateSocketMessage = SocketMessageTemplate<'AuthenticateSocketMessage', string>;
export type AuthenticateResponseSocketMessage = SocketMessageTemplate<'AuthenticateResponseSocketMessage', {
	success: boolean,
	error?: string
}>;
export type RequestInitialDataMessage = SocketMessageTemplate<'RequestInitialDataMessage', string>;
export type InitialDataResponseMessage = SocketMessageTemplate<'InitialDataResponseMessage', {
	state: GameState | null,
	data: null
}>;

export type SocketMessage =
	LogSocketMessage |
	AuthenticateSocketMessage |
	AuthenticateResponseSocketMessage |
	RequestInitialDataMessage |
	InitialDataResponseMessage;
