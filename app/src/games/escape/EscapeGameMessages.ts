import { SerialEscapeGameData } from 'app/src/games/escape/server/EscapeGameData';

import { SocketMessage } from '../../models/SocketMessage';
import EscapeGamePlayer from './EscapeGamePlayer';
import { Direction } from './Movement';

export function getScope(title: string, id: string): string {
	return `game.${title}.${id}`;
}

export type LeaveGameMessage = SocketMessage<'LeaveGameMessage', { id: string }>;
export type LeaveGameResponseMessage = SocketMessage<
	'LeaveGameResponseMessage',
	{ error?: string }
>;

export type AddPlayerMessage = SocketMessage<'AddPlayerMessage', { name: string }>;
export type AddPlayerResponseMessage = SocketMessage<
	'AddPlayerResponseMessage',
	{ error?: string }
>;

export type RemovePlayerMessage = SocketMessage<'RemovePlayerMessage', { playerId?: string }>;
export type RemovePlayerResponseMessage = SocketMessage<
	'RemovePlayerResponseMessage',
	{ error?: string }
>;

export type StartGameMessage = SocketMessage<'StartGameMessage', void>;
export type StartGameResponseMessage = SocketMessage<
	'StartGameResponseMessage',
	{ error?: string }
>;

export type UpdatePlayerMessage = SocketMessage<'AddPlayerMessage', { name: string }>;
export type PlayerUpdatedMessage = SocketMessage<
	'PlayerUpdatedMessage',
	{ playerId: string; player: EscapeGamePlayer }
>;

export type MovePlayerMessage = SocketMessage<
	'MovePlayerMessage',
	{ playerId?: string; direction: Direction }
>;
export type MovePlayerResponseMessage = SocketMessage<
	'MovePlayerResponseMessage',
	{ error?: string }
>;

export type GetGameDataMessage = SocketMessage<'GetGameDataMessage', void>;
export type RefreshGameDataMessage = SocketMessage<'RefreshGameDataMessage', SerialEscapeGameData>;

export type EscapeGameMessage =
	| LeaveGameMessage
	| LeaveGameResponseMessage
	| AddPlayerMessage
	| AddPlayerResponseMessage
	| RemovePlayerMessage
	| RemovePlayerResponseMessage
	| StartGameMessage
	| StartGameResponseMessage
	| UpdatePlayerMessage
	| PlayerUpdatedMessage
	| MovePlayerMessage
	| MovePlayerResponseMessage
	| GetGameDataMessage
	| RefreshGameDataMessage;
