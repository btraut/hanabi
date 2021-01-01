import { SerialEscapeGameData } from 'app/src/games/escape/server/EscapeGameData';

import { SocketMessage } from '../../models/SocketMessage';
import Player from './EscapeGamePlayer';
import { Direction, Location } from './Movement';

export function getScope(id: string): string {
	return `game.escape.${id}`;
}

export type LeaveGameMessage = SocketMessage<'LeaveGameMessage', { id: string }>;
export type LeaveGameResponseMessage = SocketMessage<
	'LeaveGameResponseMessage',
	{ error?: string }
>;

export type GetStateMessage = SocketMessage<'GetStateMessage', void>;
export type GetStateResponseMessage = SocketMessage<
	'GetStateResponseMessage',
	{
		state: SerialEscapeGameData;
	}
>;

export type AddPlayerMessage = SocketMessage<'AddPlayerMessage', { name: string }>;
export type AddPlayerResponseMessage = SocketMessage<
	'AddPlayerResponseMessage',
	{ error?: string }
>;
export type PlayerAddedMessage = SocketMessage<
	'PlayerAddedMessage',
	{ playerId: string; player: Player }
>;

export type RemovePlayerMessage = SocketMessage<'RemovePlayerMessage', { playerId: string }>;
export type PlayerRemovedMessage = SocketMessage<'PlayerRemovedMessage', { playerId: string }>;

export type UpdatePlayerMessage = SocketMessage<'AddPlayerMessage', { name: string }>;
export type PlayerUpdatedMessage = SocketMessage<
	'PlayerUpdatedMessage',
	{ playerId: string; player: Player }
>;

export type MovePlayerMessage = SocketMessage<
	'MovePlayerMessage',
	{ playerId: string; direction: Direction }
>;
export type PlayerMovedMessage = SocketMessage<
	'PlayerMovedMessage',
	{ playerId: string; to: Location }
>;

export type EscapeGameMessage =
	| LeaveGameMessage
	| LeaveGameResponseMessage
	| AddPlayerMessage
	| AddPlayerResponseMessage
	| PlayerAddedMessage
	| RemovePlayerMessage
	| PlayerRemovedMessage
	| UpdatePlayerMessage
	| PlayerUpdatedMessage
	| GetStateMessage
	| GetStateResponseMessage
	| MovePlayerMessage
	| PlayerMovedMessage;
