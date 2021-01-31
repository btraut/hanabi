import { shuffle } from 'app/src/utils/shuffle';
import { v4 as uuidv4 } from 'uuid';

export const HANABI_GAME_TITLE = 'hanabi';

export const HANABI_MIN_PLAYERS = 1;
export const HANABI_MAX_PLAYERS = 5;

export const HANABI_MAX_CLUES = 8;
export const HANABI_MAX_LIVES = 3;

export interface Size {
	width: number;
	height: number;
}

export interface Position {
	x: number;
	y: number;
}

export interface Rect extends Size, Position {}

export const HANABI_BOARD_SIZE: Size = { width: 500, height: 160 };
export const HANABI_TILE_SIZE: Size = { width: 40, height: 48 };
export const HANABI_TILE_SIZE_SMALL: Size = { width: 30, height: 36 };

export const HANABI_TILES_IN_HAND: { [numPlayers: number]: number } = {
	'1': 5,
	'2': 5,
	'3': 5,
	'4': 4,
	'5': 4,
};

export const HANABI_DEFAULT_TILE_POSITIONS: { [tileNumber: number]: Position } = [
	{ x: 10, y: 10 },
	{ x: 60, y: 10 },
	{ x: 110, y: 10 },
	{ x: 160, y: 10 },
	{ x: 210, y: 10 },
];

export enum HanabiStage {
	Setup = 'Setup',
	Playing = 'Playing',
	Finished = 'Finished',
}

export enum HanabiFinishedReason {
	Won = 'Won',
	DiscardedFatalTile = 'DiscardedFatalTile',
	OutOfTurns = 'OutOfTurns',
	OutOfLives = 'OutOfLives',
}

export enum HanabiRuleSet {
	Basic = 'Basic',
	PurpleDistinct = 'PurpleDistinct',
	PurpleDecoy = 'PurpleDecoy',
}

export enum HanabiShowActionsLimit {
	ShowAll = 'ShowAll',
	ShowLast = 'ShowLast',
}

export type HanabiTileColor = 'red' | 'blue' | 'green' | 'yellow' | 'white' | 'purple';

export type HanabiTileNumber = 1 | 2 | 3 | 4 | 5;

export interface HanabiTile {
	id: string;
	color: HanabiTileColor;
	number: HanabiTileNumber;
	zIndex: number;
}

export const tileColorClasses = {
	red: 'text-red-500',
	blue: 'text-blue-500',
	green: 'text-green-500',
	yellow: 'text-yellow-500',
	white: 'text-white',
	purple: 'text-purple-500',
};

export const tileBackgroundClasses = {
	red: 'bg-red-500',
	blue: 'bg-blue-500',
	green: 'bg-green-500',
	yellow: 'bg-yellow-500',
	white: 'bg-white',
	purple: 'bg-purple-500',
};

export interface HanabiTileLocation {
	tile: HanabiTile;
	position: Position;
}

export interface HanabiPlayer {
	id: string;
	connected: boolean;
	name: string;
	tileLocations: HanabiTileLocation[];
}

export enum HanabiGameActionType {
	Play = 'Play',
	Discard = 'Discard',
	GiveColorClue = 'GiveColorClue',
	GiveNumberClue = 'GiveNumberClue',
}

export interface HanabiGameActionPlay {
	id: string;
	playerId: string;
	type: HanabiGameActionType.Play;
	tile: HanabiTile;
	remainingLives: number;
	valid: boolean;
}

export interface HanabiGameActionDiscard {
	id: string;
	playerId: string;
	type: HanabiGameActionType.Discard;
	tile: HanabiTile;
}

export interface HanabiGameActionGiveClue {
	id: string;
	playerId: string;
	type: HanabiGameActionType.GiveNumberClue | HanabiGameActionType.GiveColorClue;
	recipientId: string;
	tiles: HanabiTile[];
	color?: HanabiTileColor;
	number?: HanabiTileNumber;
}

export type HanabiGameAction =
	| HanabiGameActionPlay
	| HanabiGameActionDiscard
	| HanabiGameActionGiveClue;

export interface HanabiGameData {
	stage: HanabiStage;
	finishedReason: HanabiFinishedReason | null;
	players: { [id: string]: HanabiPlayer };
	turnOrder: string[];
	remainingTurns: number | null;
	remainingTiles: HanabiTile[];
	playedTiles: HanabiTile[];
	discardedTiles: HanabiTile[];
	ruleSet: HanabiRuleSet;
	clues: number;
	lives: number;
	actions: HanabiGameAction[];
	showActionsLimit: HanabiShowActionsLimit;
}

export function generateHanabiGameData(data: Partial<HanabiGameData> = {}): HanabiGameData {
	return {
		stage: HanabiStage.Setup,
		finishedReason: null,
		players: {},
		turnOrder: [],
		remainingTurns: null,
		remainingTiles: [],
		playedTiles: [],
		discardedTiles: [],
		clues: HANABI_MAX_CLUES,
		lives: HANABI_MAX_LIVES,
		ruleSet: HanabiRuleSet.Basic,
		actions: [],
		showActionsLimit: HanabiShowActionsLimit.ShowAll,
		...data,
	};
}

export function generatePlayer(data: Partial<HanabiPlayer> = {}): HanabiPlayer {
	return {
		connected: true,
		id: uuidv4(),
		name: '',
		tileLocations: [],
		...data,
	};
}

export function generateRandomDeck(includePurple = false): HanabiTile[] {
	const tiles: HanabiTile[] = [];

	const colors: HanabiTileColor[] = ['red', 'blue', 'green', 'yellow', 'white'];
	if (includePurple) {
		colors.push('purple');
	}

	const numbers: HanabiTileNumber[] = [1, 1, 1, 2, 2, 3, 3, 4, 4, 5];

	for (const color of colors) {
		for (const number of numbers) {
			tiles.push({
				id: uuidv4(),
				color,
				number,
				zIndex: 0,
			});
		}
	}

	return shuffle(tiles);
}

export const HANABI_BLANK_TILE: HanabiTile = { id: '', number: 1, color: 'red', zIndex: 0 };
