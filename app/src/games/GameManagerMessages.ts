import { SocketMessage } from '../models/SocketMessage';

export type HostGameMessage = SocketMessage<
	'HostGameMessage',
	{
		title: string;
	}
>;

export type HostGameErrorInvalidTitleMessage = SocketMessage<
	'HostGameErrorInvalidTitleMessage',
	{
		title: string;
	}
>;

export type GameManagerMessage = HostGameMessage | HostGameErrorInvalidTitleMessage;
