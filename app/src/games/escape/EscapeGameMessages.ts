import { SerialEscapeGameData } from 'app/src/games/escape/server/EscapeGameData';

import { SocketMessage } from '../../models/SocketMessage';
import EscapeGamePlayer from './EscapeGamePlayer';
import { Direction, Location } from './Movement';

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
export type PlayerAddedMessage = SocketMessage<
	'PlayerAddedMessage',
	{ playerId: string; player: EscapeGamePlayer }
>;

export type RemovePlayerMessage = SocketMessage<'RemovePlayerMessage', { playerId?: string }>;
export type RemovePlayerResponseMessage = SocketMessage<
	'RemovePlayerResponseMessage',
	{ error?: string }
>;
export type PlayerRemovedMessage = SocketMessage<'PlayerRemovedMessage', { playerId: string }>;

export type UpdatePlayerMessage = SocketMessage<'AddPlayerMessage', { name: string }>;
export type PlayerUpdatedMessage = SocketMessage<
	'PlayerUpdatedMessage',
	{ playerId: string; player: EscapeGamePlayer }
>;

export type MovePlayerMessage = SocketMessage<
	'MovePlayerMessage',
	{ playerId: string; direction: Direction }
>;
export type PlayerMovedMessage = SocketMessage<
	'PlayerMovedMessage',
	{ playerId: string; to: Location }
>;

export type GetGameDataMessage = SocketMessage<'GetGameDataMessage', void>;
export type GetGameDataResponseMessage = SocketMessage<
	'GetGameDataResponseMessage',
	SerialEscapeGameData
>;

export type EscapeGameMessage =
	| LeaveGameMessage
	| LeaveGameResponseMessage
	| AddPlayerMessage
	| AddPlayerResponseMessage
	| PlayerAddedMessage
	| RemovePlayerMessage
	| RemovePlayerResponseMessage
	| PlayerRemovedMessage
	| UpdatePlayerMessage
	| PlayerUpdatedMessage
	| MovePlayerMessage
	| PlayerMovedMessage
	| GetGameDataMessage
	| GetGameDataResponseMessage;
