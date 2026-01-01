import { SocketMessage } from '../models/SocketMessage.js';

export const SOCKET_MANAGER_SCOPE = 'socket-manager';

export type AuthenticateSocketMessage = SocketMessage<'AuthenticateSocketMessage', string>;
export type AuthenticateSocketResponseMessage = SocketMessage<
	'AuthenticateSocketResponseMessage',
	{ userId?: string; error?: string }
>;

export type AuthSocketManagerMessage =
	| AuthenticateSocketMessage
	| AuthenticateSocketResponseMessage;
