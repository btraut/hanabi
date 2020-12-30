import { SocketMessage } from '../models/SocketMessage';

export const GAME_MANAGER_SOCKET_MESSAGE_SCOPE = '__GAME_MANAGER_SOCKET_MESSAGE_SCOPE__';

export type HostGameMessage = SocketMessage<
	'HostGameMessage',
	{
		title: string;
	}
>;

export type HostGameResponseMessage = SocketMessage<
	'HostGameResponseMessage',
	{ id?: string; error?: string }
>;

export type GameManagerMessage = HostGameMessage | HostGameResponseMessage;
