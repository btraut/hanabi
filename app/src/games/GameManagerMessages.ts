import { SocketMessage } from '../models/SocketMessage';

export const GAME_MANAGER_SCOPE = '__GAME_MANAGER_SCOPE__';

export type CreateGameMessage = SocketMessage<'CreateGameMessage', { title: string }>;
export type CreateGameResponseMessage = SocketMessage<
	'CreateGameResponseMessage',
	{ game?: { id: string; code: string }; error?: string }
>;

export type WatchGameMessage = SocketMessage<'WatchGameMessage', { code: string }>;
export type WatchGameResponseMessage = SocketMessage<
	'WatchGameResponseMessage',
	{ game?: { id: string; code: string }; error?: string }
>;

export type GameManagerMessage =
	| CreateGameMessage
	| CreateGameResponseMessage
	| WatchGameMessage
	| WatchGameResponseMessage;
