import { Direction } from 'app/src/games/escape/Movement';
import { SerialEscapeGameData } from 'app/src/games/escape/server/EscapeGameData';
import { SocketMessage } from 'app/src/models/SocketMessage';

export function getScope(title: string, id: string): string {
	return `game.${title}.${id}`;
}

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

export type EscapeMessage =
	| AddPlayerMessage
	| AddPlayerResponseMessage
	| RemovePlayerMessage
	| RemovePlayerResponseMessage
	| StartGameMessage
	| StartGameResponseMessage
	| MovePlayerMessage
	| MovePlayerResponseMessage
	| GetGameDataMessage
	| RefreshGameDataMessage;
