import { SocketMessage } from '../models/SocketMessage';

export const SOCKET_MANAGER_MESSAGE_SCOPE = '__SOCKET_MANAGER_MESSAGE_SCOPE__';

export type AuthenticateSocketMessage = SocketMessage<'AuthenticateSocketMessage', string>;

export type AuthenticateSocketResponseMessage = SocketMessage<
	'AuthenticateSocketResponseMessage',
	{ error?: string }
>;

export type ServerSocketManagerMessage =
	| AuthenticateSocketMessage
	| AuthenticateSocketResponseMessage;
