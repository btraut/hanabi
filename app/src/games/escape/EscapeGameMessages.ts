import SocketMessage from '../../models/SocketMessage';
import { Direction, Location } from './Movement';
import Player from './Player';

export type GetStateMessage = SocketMessage<'getState', void>;
export type ResetStateMessage = SocketMessage<
	'resetState',
	{ map: string[][][]; players: { [id: string]: Player } }
>;

export type AddPlayerMessage = SocketMessage<'addPlayer', { name: string }>;
export type PlayerAddedMessage = SocketMessage<'playerAdded', { playerId: string; player: Player }>;

export type RemovePlayerMessage = SocketMessage<'removePlayer', { playerId: string }>;
export type PlayerRemovedMessage = SocketMessage<'playerRemoved', { playerId: string }>;

export type MovePlayerMessage = SocketMessage<
	'movePlayer',
	{ playerId: string; direction: Direction }
>;
export type PlayerMovedMessage = SocketMessage<'playerMoved', { playerId: string; to: Location }>;

export type EscapeGameMessage =
	| GetStateMessage
	| ResetStateMessage
	| AddPlayerMessage
	| PlayerAddedMessage
	| RemovePlayerMessage
	| PlayerRemovedMessage
	| MovePlayerMessage
	| PlayerMovedMessage;
