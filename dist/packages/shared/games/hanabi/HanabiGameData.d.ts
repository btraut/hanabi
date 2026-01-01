export declare const HANABI_GAME_TITLE = "hanabi";
export declare const HANABI_MIN_PLAYERS = 2;
export declare const HANABI_MAX_PLAYERS = 5;
export declare const HANABI_MAX_CLUES = 8;
export declare const HANABI_MAX_LIVES = 3;
export interface Size {
    width: number;
    height: number;
}
export interface Position {
    x: number;
    y: number;
    z: number;
}
export declare const HANABI_TILES_IN_HAND: {
    [numPlayers: number]: number;
};
export declare const HANABI_BOARD_SIZE: Size;
export declare const HANABI_TILE_SIZE: Size;
export declare const HANABI_TILE_SIZE_SMALL: Size;
export declare const HANABI_DEFAULT_TILE_PADDING = 10;
export declare const HANABI_DEFAULT_TILE_POSITIONS: {
    [tileNumber: number]: Position;
};
export declare enum HanabiStage {
    Setup = "Setup",
    Playing = "Playing",
    Finished = "Finished"
}
export declare enum HanabiFinishedReason {
    Won = "Won",
    DiscardedFatalTile = "DiscardedFatalTile",
    OutOfTurns = "OutOfTurns",
    OutOfLives = "OutOfLives"
}
export type HanabiRuleSet = '5-color' | '6-color' | 'rainbow';
export type HanabiTileColor = 'red' | 'blue' | 'green' | 'yellow' | 'white' | 'purple' | 'rainbow';
export type HanabiTileNumber = 1 | 2 | 3 | 4 | 5;
export interface HanabiTile {
    id: string;
    color: HanabiTileColor;
    number: HanabiTileNumber;
}
export declare const tileColorClasses: {
    red: string;
    blue: string;
    green: string;
    yellow: string;
    white: string;
    purple: string;
    rainbow: string;
};
export declare const tileBackgroundClasses: {
    red: string;
    blue: string;
    green: string;
    yellow: string;
    white: string;
    purple: string;
    rainbow: string;
};
export interface HanabiPlayer {
    id: string;
    connected: boolean;
    name: string;
}
export declare enum HanabiGameActionType {
    Play = "Play",
    Discard = "Discard",
    GiveColorClue = "GiveColorClue",
    GiveNumberClue = "GiveNumberClue",
    ShotClockStarted = "ShotClockStarted",
    ShotClockTickedDown = "ShotClockTickedDown",
    GameStarted = "GameStarted",
    GameFinished = "GameFinished",
    Chat = "Chat"
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
export interface HanabiGameActionDiscard extends HanabiGameActionBase<HanabiGameActionType.Discard> {
    playerId: string;
    tile: HanabiTile;
}
export interface HanabiGameActionGiveClue extends HanabiGameActionBase<HanabiGameActionType.GiveNumberClue | HanabiGameActionType.GiveColorClue> {
    playerId: string;
    recipientId: string;
    tiles: HanabiTile[];
    color?: HanabiTileColor;
    number?: HanabiTileNumber;
}
export interface HanabiGameActionGameStarted extends HanabiGameActionBase<HanabiGameActionType.GameStarted> {
    startingPlayerId: string;
}
export interface HanabiGameActionGameFinished extends HanabiGameActionBase<HanabiGameActionType.GameFinished> {
    finishedReason: HanabiFinishedReason;
}
export interface HanabiGameActionShotClockStarted extends HanabiGameActionBase<HanabiGameActionType.ShotClockStarted> {
    playerId: string;
    remainingTurns: number;
}
export interface HanabiGameActionShotClockTickedDown extends HanabiGameActionBase<HanabiGameActionType.ShotClockTickedDown> {
    playerId: string;
    remainingTurns: number;
}
export interface HanabiGameActionChat extends HanabiGameActionBase<HanabiGameActionType.Chat> {
    playerId: string;
    message: string;
}
export type HanabiGameAction = HanabiGameActionPlay | HanabiGameActionDiscard | HanabiGameActionGiveClue | HanabiGameActionGameStarted | HanabiGameActionGameFinished | HanabiGameActionShotClockStarted | HanabiGameActionShotClockTickedDown | HanabiGameActionChat;
export type ActionsFilterOption = 'all' | 'to-me' | 'from-me' | 'chat' | 'clues';
export type HanabiTileNotes = {
    colors: readonly HanabiTileColor[];
    numbers: readonly HanabiTileNumber[];
};
export interface HanabiGameData {
    seed: string;
    ruleSet: HanabiRuleSet;
    allowDragging: boolean;
    showNotes: boolean;
    criticalGameOver: boolean;
    stage: HanabiStage;
    finishedReason: HanabiFinishedReason | null;
    players: {
        readonly [id: string]: HanabiPlayer;
    };
    currentPlayerId: string | null;
    turnOrder: readonly string[];
    remainingTurns: number | null;
    clues: number;
    lives: number;
    tiles: {
        readonly [tileId: string]: HanabiTile;
    };
    remainingTiles: readonly string[];
    playedTiles: readonly string[];
    discardedTiles: readonly string[];
    playerTiles: {
        readonly [playerId: string]: string[];
    };
    tilePositions: {
        readonly [tileId: string]: Position;
    };
    tileNotes: {
        readonly [tileId: string]: HanabiTileNotes;
    };
    actions: readonly HanabiGameAction[];
}
export declare function generateHanabiGameData(data?: Partial<HanabiGameData>): HanabiGameData;
export declare function generatePlayer(data?: Partial<HanabiPlayer>): HanabiPlayer;
export declare function generateRandomDeck(ruleSet: HanabiRuleSet, seed: string): [{
    [tileId: string]: HanabiTile;
}, string[]];
export declare function addToTileNotes(tileNotes: HanabiTileNotes | undefined, newColor: HanabiTileColor | undefined, newNumber: HanabiTileNumber | undefined): HanabiTileNotes;
//# sourceMappingURL=HanabiGameData.d.ts.map