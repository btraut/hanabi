import { SocketMessage } from 'app/src/models/SocketMessage';

export const SOCKET_MANAGER_SCOPE = 'socket-manager';

export type AuthenticateSocketMessage = SocketMessage<'AuthenticateSocketMessage', string>;
export type AuthenticateSocketResponseMessage = SocketMessage<
	'AuthenticateSocketResponseMessage',
	{ userId?: string; error?: string }
>;

export type AuthSocketManagerMessage =
	| AuthenticateSocketMessage
	| AuthenticateSocketResponseMessage;
