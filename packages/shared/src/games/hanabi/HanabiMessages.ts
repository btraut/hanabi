import {
	HanabiGameData,
	HanabiRuleSet,
	HanabiClueColor,
	HanabiTileNumber,
	Position,
} from './HanabiGameData.js';
import { SocketMessage } from '../../models/SocketMessage.js';

export function getScope(title: string, id: string): string {
	return `game.${title}.${id}`;
}

// Game State
export type GetGameDataMessage = SocketMessage<'GetGameDataMessage', void>;
export type RefreshGameDataMessage = SocketMessage<'RefreshGameDataMessage', HanabiGameData>;

// Player Management
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

export type CreateDebugPlayerMessage = SocketMessage<'CreateDebugPlayerMessage', void>;
export type CreateDebugPlayerResponseMessage = SocketMessage<
	'CreateDebugPlayerResponseMessage',
	{ playerId?: string; error?: string }
>;

export type DebugPlayerAction =
	| { type: 'play'; tileId: string }
	| { type: 'discard'; tileId: string }
	| {
			type: 'clue';
			to: string;
			color?: HanabiClueColor;
			number?: HanabiTileNumber;
	  };
export type DebugPlayerActionMessage = SocketMessage<
	'DebugPlayerActionMessage',
	{ action: DebugPlayerAction }
>;
export type DebugPlayerActionResponseMessage = SocketMessage<
	'DebugPlayerActionResponseMessage',
	{ error?: string }
>;

// State Management
export type ChangeGameSettingsMessage = SocketMessage<
	'ChangeGameSettingsMessage',
	{
		ruleSet?: HanabiRuleSet;
		allowDragging?: boolean;
		showNotes?: boolean;
		criticalGameOver?: boolean;
	}
>;
export type ChangeGameSettingsResponseMessage = SocketMessage<
	'ChangeGameSettingsResponseMessage',
	{ error?: string }
>;

export type SendChatMessage = SocketMessage<'SendChatMessage', string>;
export type SendChatResponseMessage = SocketMessage<'SendChatResponseMessage', { error?: string }>;

export type StartGameMessage = SocketMessage<'StartGameMessage', void>;
export type StartGameResponseMessage = SocketMessage<
	'StartGameResponseMessage',
	{ error?: string }
>;

export type ResetGameMessage = SocketMessage<'ResetGameMessage', void>;
export type ResetGameResponseMessage = SocketMessage<
	'ResetGameResponseMessage',
	{ error?: string }
>;

// Game Actions
export type PlayTileMessage = SocketMessage<'PlayTileMessage', { id: string }>;
export type PlayTileResponseMessage = SocketMessage<'PlayTileResponseMessage', { error?: string }>;

export type DiscardTileMessage = SocketMessage<'DiscardTileMessage', { id: string }>;
export type DiscardTileResponseMessage = SocketMessage<
	'DiscardTileResponseMessage',
	{ error?: string }
>;

export type GiveClueMessage = SocketMessage<
	'GiveClueMessage',
	{ to: string; color?: HanabiClueColor; number?: HanabiTileNumber }
>;
export type GiveClueResponseMessage = SocketMessage<'GiveClueResponseMessage', { error?: string }>;

export type MoveTilesMessage = SocketMessage<'MoveTilesMessage', { [tileId: string]: Position }>;
export type MoveTilesResponseMessage = SocketMessage<
	'MoveTilesResponseMessage',
	{ error?: string }
>;

export type HanabiMessage =
	| GetGameDataMessage
	| RefreshGameDataMessage
	| AddPlayerMessage
	| AddPlayerResponseMessage
	| RemovePlayerMessage
	| RemovePlayerResponseMessage
	| CreateDebugPlayerMessage
	| CreateDebugPlayerResponseMessage
	| DebugPlayerActionMessage
	| DebugPlayerActionResponseMessage
	| ChangeGameSettingsMessage
	| ChangeGameSettingsResponseMessage
	| SendChatMessage
	| SendChatResponseMessage
	| StartGameMessage
	| StartGameResponseMessage
	| ResetGameMessage
	| ResetGameResponseMessage
	| PlayTileMessage
	| PlayTileResponseMessage
	| DiscardTileMessage
	| DiscardTileResponseMessage
	| GiveClueMessage
	| GiveClueResponseMessage
	| MoveTilesMessage
	| MoveTilesResponseMessage;
