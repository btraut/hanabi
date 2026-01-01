import { shuffle } from '../../utils/shuffle.js';
import { v4 as uuidv4 } from 'uuid';
export const HANABI_GAME_TITLE = 'hanabi';
export const HANABI_MIN_PLAYERS = 2;
export const HANABI_MAX_PLAYERS = 5;
export const HANABI_MAX_CLUES = 8;
export const HANABI_MAX_LIVES = 3;
export const HANABI_TILES_IN_HAND = {
    '1': 5,
    '2': 5,
    '3': 5,
    '4': 4,
    '5': 4,
};
export const HANABI_BOARD_SIZE = { width: 400, height: 140 };
export const HANABI_TILE_SIZE = { width: 40, height: 48 };
export const HANABI_TILE_SIZE_SMALL = { width: 30, height: 36 };
export const HANABI_DEFAULT_TILE_PADDING = 10;
export const HANABI_DEFAULT_TILE_POSITIONS = [
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
export var HanabiStage;
(function (HanabiStage) {
    HanabiStage["Setup"] = "Setup";
    HanabiStage["Playing"] = "Playing";
    HanabiStage["Finished"] = "Finished";
})(HanabiStage || (HanabiStage = {}));
export var HanabiFinishedReason;
(function (HanabiFinishedReason) {
    HanabiFinishedReason["Won"] = "Won";
    HanabiFinishedReason["DiscardedFatalTile"] = "DiscardedFatalTile";
    HanabiFinishedReason["OutOfTurns"] = "OutOfTurns";
    HanabiFinishedReason["OutOfLives"] = "OutOfLives";
})(HanabiFinishedReason || (HanabiFinishedReason = {}));
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
export var HanabiGameActionType;
(function (HanabiGameActionType) {
    HanabiGameActionType["Play"] = "Play";
    HanabiGameActionType["Discard"] = "Discard";
    HanabiGameActionType["GiveColorClue"] = "GiveColorClue";
    HanabiGameActionType["GiveNumberClue"] = "GiveNumberClue";
    HanabiGameActionType["ShotClockStarted"] = "ShotClockStarted";
    HanabiGameActionType["ShotClockTickedDown"] = "ShotClockTickedDown";
    HanabiGameActionType["GameStarted"] = "GameStarted";
    HanabiGameActionType["GameFinished"] = "GameFinished";
    HanabiGameActionType["Chat"] = "Chat";
})(HanabiGameActionType || (HanabiGameActionType = {}));
export function generateHanabiGameData(data = {}) {
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
export function generatePlayer(data = {}) {
    return {
        connected: true,
        id: uuidv4(),
        name: '',
        ...data,
    };
}
export function generateRandomDeck(ruleSet, seed) {
    const tiles = {};
    const tileIds = [];
    const colors = ['red', 'blue', 'green', 'yellow', 'white'];
    if (ruleSet === 'rainbow') {
        colors.push('rainbow');
    }
    else if (ruleSet === '6-color') {
        colors.push('purple');
    }
    const numbers = [1, 1, 1, 2, 2, 3, 3, 4, 4, 5];
    for (const color of colors) {
        for (const number of numbers) {
            const id = uuidv4();
            tiles[id] = { id, color, number };
            tileIds.push(id);
        }
    }
    return [tiles, shuffle(tileIds, seed)];
}
export function addToTileNotes(tileNotes, newColor, newNumber) {
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
