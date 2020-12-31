import { SocketMessage } from '../models/SocketMessage';

export const SOCKET_MANAGER_SCOPE = 'socket-manager';

export type AuthenticateSocketMessage = SocketMessage<'AuthenticateSocketMessage', string>;

export type AuthenticateSocketResponseMessage = SocketMessage<
	'AuthenticateSocketResponseMessage',
	{ error?: string }
>;

export type ServerSocketManagerMessage =
	| AuthenticateSocketMessage
	| AuthenticateSocketResponseMessage;
