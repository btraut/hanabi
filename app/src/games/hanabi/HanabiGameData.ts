import { shuffle } from 'app/src/utils/shuffle';
import { v4 as uuidv4 } from 'uuid';

export const HANABI_GAME_TITLE = 'hanabi';

export const HANABI_MIN_PLAYERS = 2;
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
	z: number;
}

export const HANABI_TILES_IN_HAND: { [numPlayers: number]: number } = {
	'1': 5,
	'2': 5,
	'3': 5,
	'4': 4,
	'5': 4,
};

export const HANABI_BOARD_SIZE: Size = { width: 400, height: 140 };
export const HANABI_TILE_SIZE: Size = { width: 40, height: 48 };
export const HANABI_TILE_SIZE_SMALL: Size = { width: 30, height: 36 };
export const HANABI_DEFAULT_TILE_PADDING = 10;
export const HANABI_DEFAULT_TILE_POSITIONS: { [tileNumber: number]: Position } = [
	{
		x: HANABI_DEFAULT_TILE_PADDING + (HANABI_DEFAULT_TILE_PADDING + HANABI_TILE_SIZE.width) * 0,
		y: HANABI_DEFAULT_TILE_PADDING,
		z: 0,
	},
	{
		x: HANABI_DEFAULT_TILE_PADDING + (HANABI_DEFAULT_TILE_PADDING + HANABI_TILE_SIZE.width) * 1,
		y: HANABI_DEFAULT_TILE_PADDING,
		z: 0,
	},
	{
		x: HANABI_DEFAULT_TILE_PADDING + (HANABI_DEFAULT_TILE_PADDING + HANABI_TILE_SIZE.width) * 2,
		y: HANABI_DEFAULT_TILE_PADDING,
		z: 0,
	},
	{
		x: HANABI_DEFAULT_TILE_PADDING + (HANABI_DEFAULT_TILE_PADDING + HANABI_TILE_SIZE.width) * 3,
		y: HANABI_DEFAULT_TILE_PADDING,
		z: 0,
	},
	{
		x: HANABI_DEFAULT_TILE_PADDING + (HANABI_DEFAULT_TILE_PADDING + HANABI_TILE_SIZE.width) * 4,
		y: HANABI_DEFAULT_TILE_PADDING,
		z: 0,
	},
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

export type HanabiRuleSet = '5-color' | '6-color' | 'rainbow';

export type HanabiTileColor = 'red' | 'blue' | 'green' | 'yellow' | 'white' | 'purple' | 'rainbow';

export type HanabiTileNumber = 1 | 2 | 3 | 4 | 5;

export interface HanabiTile {
	id: string;
	color: HanabiTileColor;
	number: HanabiTileNumber;
}

export const tileColorClasses = {
	red: 'text-red-500',
	blue: 'text-blue-500',
	green: 'text-green-500',
	yellow: 'text-yellow-500',
	white: 'text-white',
	purple: 'text-purple-500',
	rainbow: 'text-rainbow',
};

export const tileBackgroundClasses = {
	red: 'bg-red-500',
	blue: 'bg-blue-500',
	green: 'bg-green-500',
	yellow: 'bg-yellow-500',
	white: 'bg-white',
	purple: 'bg-purple-500',
	rainbow: 'bg-rainbow',
};

export interface HanabiPlayer {
	id: string;
	connected: boolean;
	name: string;
}

export enum HanabiGameActionType {
	Play = 'Play',
	Discard = 'Discard',
	GiveColorClue = 'GiveColorClue',
	GiveNumberClue = 'GiveNumberClue',
	ShotClockStarted = 'ShotClockStarted',
	ShotClockTickedDown = 'ShotClockTickedDown',
	GameStarted = 'GameStarted',
	GameFinished = 'GameFinished',
	Chat = 'Chat',
}

export interface HanabiGameActionBase<Type> {
	id: string;
	type: Type;
}

export interface HanabiGameActionPlay extends HanabiGameActionBase<HanabiGameActionType.Play> {
	playerId: string;
	tile: HanabiTile;
	remainingLives: number;
	valid: boolean;
}

export interface HanabiGameActionDiscard
	extends HanabiGameActionBase<HanabiGameActionType.Discard> {
	playerId: string;
	tile: HanabiTile;
}

export interface HanabiGameActionGiveClue
	extends HanabiGameActionBase<
		HanabiGameActionType.GiveNumberClue | HanabiGameActionType.GiveColorClue
	> {
	playerId: string;
	recipientId: string;
	tiles: HanabiTile[];
	color?: HanabiTileColor;
	number?: HanabiTileNumber;
}

export interface HanabiGameActionGameStarted
	extends HanabiGameActionBase<HanabiGameActionType.GameStarted> {
	startingPlayerId: string;
}

export interface HanabiGameActionGameFinished
	extends HanabiGameActionBase<HanabiGameActionType.GameFinished> {
	finishedReason: HanabiFinishedReason;
}

export interface HanabiGameActionShotClockStarted
	extends HanabiGameActionBase<HanabiGameActionType.ShotClockStarted> {
	playerId: string;
	remainingTurns: number;
}

export interface HanabiGameActionShotClockTickedDown
	extends HanabiGameActionBase<HanabiGameActionType.ShotClockTickedDown> {
	playerId: string;
	remainingTurns: number;
}

export interface HanabiGameActionChat extends HanabiGameActionBase<HanabiGameActionType.Chat> {
	playerId: string;
	message: string;
}

export type HanabiGameAction =
	| HanabiGameActionPlay
	| HanabiGameActionDiscard
	| HanabiGameActionGiveClue
	| HanabiGameActionGameStarted
	| HanabiGameActionGameFinished
	| HanabiGameActionShotClockStarted
	| HanabiGameActionShotClockTickedDown
	| HanabiGameActionChat;

export type ActionsFilterOption = 'all' | 'to-me' | 'from-me' | 'chat' | 'clues';

export type HanabiTileNotes = {
	colors: readonly HanabiTileColor[];
	numbers: readonly HanabiTileNumber[];
};

export interface HanabiGameData {
	// What seed was used for the random number generator? This seed should
	// dictate all the same tile types/order at the beginning of the game.
	seed: string;

	// What kind of game is this? Regular? Rainbow?
	ruleSet: HanabiRuleSet;
	allowDragging: boolean;
	showNotes: boolean;
	criticalGameOver: boolean;

	// Where are we in the game?
	stage: HanabiStage;
	finishedReason: HanabiFinishedReason | null;

	// Who are the players, and what is their order?
	players: { readonly [id: string]: HanabiPlayer };
	currentPlayerId: string | null;
	turnOrder: readonly string[];

	// How many turns remain? This will be null until the shot clock starts at
	// the end.
	remainingTurns: number | null;

	// Game stats:
	clues: number;
	lives: number;

	// Tiles and zones:
	tiles: { readonly [tileId: string]: HanabiTile };
	remainingTiles: readonly string[];
	playedTiles: readonly string[];
	discardedTiles: readonly string[];

	// Player -> Tile mappings:
	playerTiles: { readonly [playerId: string]: string[] };
	tilePositions: { readonly [tileId: string]: Position };
	tileNotes: { readonly [tileId: string]: HanabiTileNotes };

	// Action log (including chat):
	actions: readonly HanabiGameAction[];
}

export function generateHanabiGameData(data: Partial<HanabiGameData> = {}): HanabiGameData {
	return {
		seed: uuidv4(),
		ruleSet: '5-color',
		allowDragging: true,
		showNotes: true,
		criticalGameOver: true,
		stage: HanabiStage.Setup,
		finishedReason: null,
		players: {},
		currentPlayerId: null,
		turnOrder: [],
		remainingTurns: null,
		clues: HANABI_MAX_CLUES,
		lives: HANABI_MAX_LIVES,
		tiles: {},
		remainingTiles: [],
		playedTiles: [],
		discardedTiles: [],
		playerTiles: {},
		tilePositions: {},
		tileNotes: {},
		actions: [],
		...data,
	};
}

export function generatePlayer(data: Partial<HanabiPlayer> = {}): HanabiPlayer {
	return {
		connected: true,
		id: uuidv4(),
		name: '',
		...data,
	};
}

export function generateRandomDeck(
	ruleSet: HanabiRuleSet,
	seed: string,
): [{ [tileId: string]: HanabiTile }, string[]] {
	const tiles: { [tileId: string]: HanabiTile } = {};
	const tileIds: string[] = [];

	const colors: HanabiTileColor[] = ['red', 'blue', 'green', 'yellow', 'white'];
	if (ruleSet === 'rainbow') {
		colors.push('rainbow');
	} else if (ruleSet === '6-color') {
		colors.push('purple');
	}

	const numbers: HanabiTileNumber[] = [1, 1, 1, 2, 2, 3, 3, 4, 4, 5];

	for (const color of colors) {
		for (const number of numbers) {
			const id = uuidv4();
			tiles[id] = { id, color, number };
			tileIds.push(id);
		}
	}

	return [tiles, shuffle(tileIds, seed)];
}

export function addToTileNotes(
	tileNotes: HanabiTileNotes | undefined,
	newColor: HanabiTileColor | undefined,
	newNumber: HanabiTileNumber | undefined,
): HanabiTileNotes {
	const newNotes = {
		colors: tileNotes ? [...tileNotes.colors] : [],
		numbers: tileNotes ? [...tileNotes.numbers] : [],
	};

	if (newColor !== undefined) {
		newNotes.colors.push(newColor);
	}

	if (newNumber !== undefined) {
		newNotes.numbers.push(newNumber);
	}

	return newNotes;
}
