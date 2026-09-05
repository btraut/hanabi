import type {
	HanabiClueColor,
	HanabiFinishedReason,
	HanabiRuleSet,
	HanabiTile,
	HanabiTileNumber,
	Position,
} from './HanabiGameData.js';

export const GAME_TRANSCRIPT_VERSION = 1 as const;

export type GameTranscriptStatus = 'in_progress' | 'finished' | 'reset';
export type GameTranscriptIntegrityStatus = 'complete' | 'partial' | 'conflicted';

export interface GameTranscriptPlayer {
	id: string;
	name: string;
}

export interface GameTranscriptRules {
	ruleSet: HanabiRuleSet;
	criticalGameOver: boolean;
	allowDragging: boolean;
	showNotes: boolean;
}

export interface GameTranscriptDeal {
	playerId: string;
	tileIds: string[];
}

export interface GameTranscriptResult {
	finishedReason: HanabiFinishedReason;
	score: number;
	clues: number;
	lives: number;
	remainingTurns: number | null;
}

export interface GameTranscriptPostTurn {
	/** Exact hand layout after the action, including replacement draws. */
	tilePositions?: Record<string, Position>;
	nextPlayerId: string | null;
	clues: number;
	lives: number;
	remainingTurns: number | null;
	score: number;
	status: Exclude<GameTranscriptStatus, 'reset'>;
	result?: GameTranscriptResult;
}

interface GameTranscriptMoveBase<Type extends string> {
	type: Type;
	actionId: string;
	index: number;
	createdAt: string;
	actorId: string;
	postTurn: GameTranscriptPostTurn;
}

export interface GameTranscriptPlayMove extends GameTranscriptMoveBase<'play'> {
	tileId: string;
	valid: boolean;
}

export interface GameTranscriptDiscardMove extends GameTranscriptMoveBase<'discard'> {
	tileId: string;
}

export type GameTranscriptClue =
	{ type: 'color'; value: HanabiClueColor } | { type: 'number'; value: HanabiTileNumber };

export interface GameTranscriptClueMove extends GameTranscriptMoveBase<'clue'> {
	recipientId: string;
	clue: GameTranscriptClue;
	selectedTileIds: string[];
}

export type GameTranscriptMove =
	GameTranscriptPlayMove | GameTranscriptDiscardMove | GameTranscriptClueMove;

/** A completed hand rearrangement, recorded independently of gameplay turns. */
export interface GameTranscriptHandMovement {
	type: 'reposition';
	id: string;
	createdAt: string;
	actorId: string;
	/** Number of accepted gameplay moves before this movement. Array order breaks ties. */
	afterMoveIndex: number;
	positions: Record<string, Position>;
}

export interface GameTranscriptV1 {
	version: typeof GAME_TRANSCRIPT_VERSION;
	revision: number;
	roundId: string;
	gameId: string;
	gameCode: string;
	rules: GameTranscriptRules;
	players: GameTranscriptPlayer[];
	dealOrder: GameTranscriptDeal[] | null;
	turnOrder: string[];
	deck: HanabiTile[] | null;
	moves: GameTranscriptMove[];
	/** Absent on older recordings that did not retain hand layouts. */
	initialTilePositions?: Record<string, Position>;
	handMovements?: GameTranscriptHandMovement[];
	lifecycle: {
		status: GameTranscriptStatus;
		startedAt: string | null;
		updatedAt: string;
		endedAt: string | null;
	};
	integrity: {
		status: GameTranscriptIntegrityStatus;
		reason?: string;
	};
	result?: GameTranscriptResult;
}

export type DeepReadonly<T> = T extends (...args: never[]) => unknown
	? T
	: T extends readonly (infer Item)[]
		? readonly DeepReadonly<Item>[]
		: T extends object
			? { readonly [Key in keyof T]: DeepReadonly<T[Key]> }
			: T;

export type GameTranscriptSnapshot = DeepReadonly<GameTranscriptV1>;
