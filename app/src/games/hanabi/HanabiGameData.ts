import { shuffle } from 'app/src/utils/shuffle';
import { v1 as uuidv1 } from 'uuid';

export const HANABI_GAME_TITLE = 'hanabi';

export const HANABI_MIN_PLAYERS = 1;
export const HANABI_MAX_PLAYERS = 5;

export const HANABI_MAX_CLUES = 8;
export const HANABI_LIVES = 2;

export const HANABI_MAX_POSITION = { x: 1000, y: 500 };

export const HANABI_TILES_IN_HAND: { [numPlayers: number]: number } = {
	'1': 5,
	'2': 5,
	'3': 5,
	'4': 4,
	'5': 4,
};

export const HANABI_DEFAULT_TILE_POSITIONS: { [tileNumber: number]: Position } = [
	{ x: 0, y: 0 },
	{ x: 50, y: 0 },
	{ x: 100, y: 0 },
	{ x: 150, y: 0 },
	{ x: 200, y: 0 },
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

export type HanabiTileColor = 'red' | 'blue' | 'green' | 'yellow' | 'white' | 'purple';

export type HanabiTileNumber = 1 | 2 | 3 | 4 | 5;

export interface HanabiTile {
	id: string;
	color: HanabiTileColor;
	number: HanabiTileNumber;
}

export interface Position {
	x: number;
	y: number;
}

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
	GiveClue = 'GiveClue',
}

export interface HanabiGameActionPlay {
	playerId: string;
	action: HanabiGameActionType.Play;
	valid: boolean;
}

export interface HanabiGameActionDiscard {
	playerId: string;
	action: HanabiGameActionType.Discard;
}

export interface HanabiGameActionGiveClue {
	playerId: string;
	action: HanabiGameActionType.GiveClue;
	recipientId: string;
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
		lives: HANABI_LIVES,
		ruleSet: HanabiRuleSet.Basic,
		actions: [],
		...data,
	};
}

export function generatePlayer(data: Partial<HanabiPlayer> = {}): HanabiPlayer {
	return {
		connected: true,
		id: uuidv1(),
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
				id: uuidv1(),
				color,
				number,
			});
		}
	}

	return shuffle(tiles);
}
