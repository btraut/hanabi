import { v1 as uuidv1 } from 'uuid';

export const HANABI_GAME_TITLE = 'hanabi';

export const HANABI_MIN = 2;
export const HANABI_MAX_CLUES = 8;
export const HANABI_LIVES = 2;

export enum HanabiStage {
	Setup,
	Playing,
	Finished,
}

export enum HanabiRuleSet {
	Basic,
	PurpleDistinct,
	PurpleDecoy,
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

export interface HanabiGameData {
	stage: HanabiStage;
	players: { [id: string]: HanabiPlayer };
	turnOrder: string[];
	remainingTiles: HanabiTile[];
	playedTiles: HanabiTile[];
	discardedTiles: HanabiTile[];
	ruleSet: HanabiRuleSet;
	clues: number;
	lives: number;
}

export function generateHanabiGameData(data: Partial<HanabiGameData> = {}): HanabiGameData {
	return {
		stage: HanabiStage.Setup,
		players: {},
		turnOrder: [],
		remainingTiles: [],
		playedTiles: [],
		discardedTiles: [],
		clues: HANABI_MAX_CLUES,
		lives: HANABI_LIVES,
		ruleSet: HanabiRuleSet.Basic,
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

function shuffleInPlace<T>(array: T[]): T[] {
	let currentIndex = array.length;
	let temporaryValue;
	let randomIndex;

	// While there remain elements to shuffle...
	while (0 !== currentIndex) {
		// pick a remaining element...
		randomIndex = Math.floor(Math.random() * currentIndex);
		currentIndex -= 1;

		// and swap it with the current element.
		temporaryValue = array[currentIndex];
		array[currentIndex] = array[randomIndex];
		array[randomIndex] = temporaryValue;
	}

	return array;
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

	shuffleInPlace(tiles);

	return tiles;
}
