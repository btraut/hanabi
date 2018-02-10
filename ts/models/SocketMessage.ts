import { GameData } from './Game';
import Player from './Player';

interface SocketMessageTemplate<T, D> {
	type: T;
	data: D;
}

export type AuthenticateSocketMessage = SocketMessageTemplate<'AuthenticateSocketMessage', string>;
export type AuthenticateResponseSocketMessage = SocketMessageTemplate<'AuthenticateResponseSocketMessage', {
	success: boolean;
	error?: string;
}>;

export type RequestInitialDataMessage = SocketMessageTemplate<'RequestInitialDataMessage', void>;
export type InitialDataResponseMessage = SocketMessageTemplate<'InitialDataResponseMessage', {
	game?: GameData;
}>;

export type CreateGameMessage = SocketMessageTemplate<'CreateGameMessage', void>;
export type GameCreatedMessage = SocketMessageTemplate<'GameCreatedMessage', {
	game: GameData;
}>;

export type JoinGameMessage = SocketMessageTemplate<'JoinGameMessage', {
	code: string;
}>;
export type GameJoinedMessage = SocketMessageTemplate<'GameJoinedMessage', {
	error?: string;
	game?: GameData;
}>;

export type PlayerAddedMessage = SocketMessageTemplate<'PlayerAddedMessage', { player: Player; }>;
export type UserUpdatedMessage = SocketMessageTemplate<'UserUpdatedMessage', { player: Player; }>;
export type PlayerRemovedMessage = SocketMessageTemplate<'PlayerRemovedMessage', { player: Player; }>;

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
	PlayerRemovedMessage;
