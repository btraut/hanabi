import { SocketMessage } from '../../models/SocketMessage';
import { Direction, Location } from './Movement';
import Player from './Player';

export type GetStateMessage = SocketMessage<'GetStateMessage', void>;
export type ResetStateMessage = SocketMessage<
	'ResetStateMessage',
	{ map: string[][][]; players: { [id: string]: Player } }
>;

export type AddPlayerMessage = SocketMessage<'AddPlayerMessage', { name: string }>;
export type PlayerAddedMessage = SocketMessage<
	'PlayerAddedMessage',
	{ playerId: string; player: Player }
>;

export type RemovePlayerMessage = SocketMessage<'RemovePlayerMessage', { playerId: string }>;
export type PlayerRemovedMessage = SocketMessage<'PlayerRemovedMessage', { playerId: string }>;

export type MovePlayerMessage = SocketMessage<
	'movePlayer',
	{ playerId: string; direction: Direction }
>;
export type PlayerMovedMessage = SocketMessage<
	'PlayerMovedMessage',
	{ playerId: string; to: Location }
>;

export type EscapeGameMessage =
	| GetStateMessage
	| ResetStateMessage
	| AddPlayerMessage
	| PlayerAddedMessage
	| RemovePlayerMessage
	| PlayerRemovedMessage
	| MovePlayerMessage
	| PlayerMovedMessage;
