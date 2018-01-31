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

export type SocketMessage =
	LogSocketMessage |
	AuthenticateSocketMessage |
	AuthenticateResponseSocketMessage;
