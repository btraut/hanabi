import { SocketMessage } from '../models/SocketMessage';

export type HostGameMessage = SocketMessage<
	'hostGame',
	{
		title: string;
	}
>;

export type HostGameErrorInvalidTitleMessage = SocketMessage<
	'hostGameErrorInvalidTypeMessage',
	{
		title: string;
	}
>;

export type GameManagerMessage = HostGameMessage | HostGameErrorInvalidTitleMessage;
