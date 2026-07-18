import {
	HANABI_GAME_TITLE,
	HANABI_MAX_ACTIONS,
	HANABI_MAX_CHAT_LENGTH,
	HANABI_MAX_CLUES,
	HANABI_MAX_LIVES,
	HANABI_MAX_PLAYERS,
	HANABI_MIN_PLAYERS,
	HanabiFinishedReason,
	HanabiGameActionType,
	HanabiStage,
} from '@hanabi/shared';
import HanabiGame, { HanabiGameSerialized } from './HanabiGame.js';
import GameFactory from '../server/GameFactory.js';
import { SaveGameDelegate } from '../server/GameStore.js';
import ServerSocketManager from '../../utils/SocketManager.js';

const RULE_SETS = ['5-color', '6-color', 'rainbow'] as const;
const TILE_COLORS = ['red', 'blue', 'green', 'yellow', 'white', 'purple', 'rainbow'] as const;
const TILE_NUMBERS = [1, 2, 3, 4, 5] as const;
const STAGES = Object.values(HanabiStage);
const FINISHED_REASONS = Object.values(HanabiFinishedReason);
const ACTION_TYPES = Object.values(HanabiGameActionType);
const MAX_PERSISTED_GAME_BYTES = 2 * 1024 * 1024;
const MAX_LEGACY_PERSISTED_GAME_BYTES = 16 * 1024 * 1024;

function hydrationError(message: string): never {
	throw new Error(`Could not hydrate Hanabi game: ${message}`);
}

function requireRecord(value: unknown, path: string): Record<string, unknown> {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) {
		hydrationError(`${path} must be an object.`);
	}
	return value as Record<string, unknown>;
}

function requireArray(value: unknown, path: string): unknown[] {
	if (!Array.isArray(value)) {
		hydrationError(`${path} must be an array.`);
	}
	return value;
}

function requireString(value: unknown, path: string): string {
	if (typeof value !== 'string') {
		hydrationError(`${path} must be a string.`);
	}
	return value;
}

function requireBoolean(value: unknown, path: string): boolean {
	if (typeof value !== 'boolean') {
		hydrationError(`${path} must be a boolean.`);
	}
	return value;
}

function requireFiniteNumber(value: unknown, path: string): number {
	if (typeof value !== 'number' || !Number.isFinite(value)) {
		hydrationError(`${path} must be a finite number.`);
	}
	return value;
}

function requireIntegerInRange(
	value: unknown,
	minimum: number,
	maximum: number,
	path: string,
): number {
	const number = requireFiniteNumber(value, path);
	if (!Number.isInteger(number) || number < minimum || number > maximum) {
		hydrationError(`${path} must be an integer between ${minimum} and ${maximum}.`);
	}
	return number;
}

function requireOneOf<T>(value: unknown, allowed: readonly T[], path: string): T {
	if (!allowed.includes(value as T)) {
		hydrationError(`${path} has an unsupported value.`);
	}
	return value as T;
}

function validateStringArray(value: unknown, path: string): string[] {
	return requireArray(value, path).map((entry, index) => requireString(entry, `${path}[${index}]`));
}

function validateTile(value: unknown, path: string): void {
	const tile = requireRecord(value, path);
	requireString(tile.id, `${path}.id`);
	requireOneOf(tile.color, TILE_COLORS, `${path}.color`);
	requireOneOf(tile.number, TILE_NUMBERS, `${path}.number`);
}

function validateAction(value: unknown, path: string): void {
	const action = requireRecord(value, path);
	requireString(action.id, `${path}.id`);
	const type = requireOneOf(action.type, ACTION_TYPES, `${path}.type`);

	switch (type) {
		case HanabiGameActionType.Play:
			requireString(action.playerId, `${path}.playerId`);
			validateTile(action.tile, `${path}.tile`);
			requireFiniteNumber(action.remainingLives, `${path}.remainingLives`);
			requireBoolean(action.valid, `${path}.valid`);
			break;
		case HanabiGameActionType.Discard:
			requireString(action.playerId, `${path}.playerId`);
			validateTile(action.tile, `${path}.tile`);
			break;
		case HanabiGameActionType.GiveColorClue:
			requireString(action.playerId, `${path}.playerId`);
			requireString(action.recipientId, `${path}.recipientId`);
			requireArray(action.tiles, `${path}.tiles`).forEach((tile, index) =>
				validateTile(tile, `${path}.tiles[${index}]`),
			);
			requireOneOf(action.color, TILE_COLORS, `${path}.color`);
			break;
		case HanabiGameActionType.GiveNumberClue:
			requireString(action.playerId, `${path}.playerId`);
			requireString(action.recipientId, `${path}.recipientId`);
			requireArray(action.tiles, `${path}.tiles`).forEach((tile, index) =>
				validateTile(tile, `${path}.tiles[${index}]`),
			);
			requireOneOf(action.number, TILE_NUMBERS, `${path}.number`);
			break;
		case HanabiGameActionType.ShotClockStarted:
		case HanabiGameActionType.ShotClockTickedDown:
			requireString(action.playerId, `${path}.playerId`);
			requireFiniteNumber(action.remainingTurns, `${path}.remainingTurns`);
			break;
		case HanabiGameActionType.GameStarted:
			requireString(action.startingPlayerId, `${path}.startingPlayerId`);
			break;
		case HanabiGameActionType.GameFinished:
			requireOneOf(action.finishedReason, FINISHED_REASONS, `${path}.finishedReason`);
			break;
		case HanabiGameActionType.Chat: {
			requireString(action.playerId, `${path}.playerId`);
			const message = requireString(action.message, `${path}.message`);
			if (!message.trim() || message.length > HANABI_MAX_CHAT_LENGTH) {
				hydrationError(
					`${path}.message must contain between 1 and ${HANABI_MAX_CHAT_LENGTH} characters.`,
				);
			}
			break;
		}
	}
}

function validateGameData(value: unknown): void {
	const data = requireRecord(value, 'data');
	requireString(data.seed, 'data.seed');
	const ruleSet = requireOneOf(data.ruleSet, RULE_SETS, 'data.ruleSet');
	requireBoolean(data.allowDragging, 'data.allowDragging');
	requireBoolean(data.showNotes, 'data.showNotes');
	requireBoolean(data.criticalGameOver, 'data.criticalGameOver');
	const stage = requireOneOf(data.stage, STAGES, 'data.stage');
	const finishedReason = data.finishedReason;
	if (finishedReason !== null) {
		requireOneOf(finishedReason, FINISHED_REASONS, 'data.finishedReason');
	}

	const players = requireRecord(data.players, 'data.players');
	const playerIds = Object.keys(players);
	if (playerIds.length > HANABI_MAX_PLAYERS) {
		hydrationError(`data.players must contain at most ${HANABI_MAX_PLAYERS} players.`);
	}
	for (const [id, value] of Object.entries(players)) {
		const player = requireRecord(value, `data.players.${id}`);
		if (requireString(player.id, `data.players.${id}.id`) !== id) {
			hydrationError(`data.players.${id}.id must match its map key.`);
		}
		requireBoolean(player.connected, `data.players.${id}.connected`);
		const name = requireString(player.name, `data.players.${id}.name`);
		if (!name.trim() || name.length > 40) {
			hydrationError(`data.players.${id}.name must contain between 1 and 40 characters.`);
		}
	}
	const currentPlayerId = data.currentPlayerId;
	if (data.currentPlayerId !== null) {
		requireString(data.currentPlayerId, 'data.currentPlayerId');
	}
	const turnOrder = validateStringArray(data.turnOrder, 'data.turnOrder');
	if (new Set(turnOrder).size !== turnOrder.length || turnOrder.some((id) => !players[id])) {
		hydrationError('data.turnOrder must contain unique existing player ids.');
	}
	if (stage === HanabiStage.Setup) {
		if (currentPlayerId !== null || turnOrder.length !== 0 || data.finishedReason !== null) {
			hydrationError('setup games cannot have a current player, turn order, or finished reason.');
		}
	} else {
		if (
			typeof currentPlayerId !== 'string' ||
			!turnOrder.includes(currentPlayerId) ||
			turnOrder.length !== playerIds.length
		) {
			hydrationError('started games must include every player exactly once in their turn order.');
		}
		if (
			(stage === HanabiStage.Playing && data.finishedReason !== null) ||
			(stage === HanabiStage.Finished && data.finishedReason === null)
		) {
			hydrationError('data.finishedReason must agree with data.stage.');
		}
	}
	const remainingTurns =
		data.remainingTurns === null
			? null
			: requireIntegerInRange(data.remainingTurns, 0, HANABI_MAX_PLAYERS, 'data.remainingTurns');
	requireIntegerInRange(data.clues, 0, HANABI_MAX_CLUES, 'data.clues');
	const lives = requireIntegerInRange(data.lives, 0, HANABI_MAX_LIVES, 'data.lives');
	if (stage === HanabiStage.Playing && (lives === 0 || remainingTurns === 0)) {
		hydrationError('playing games cannot have terminal life or turn counters.');
	}
	if (finishedReason === HanabiFinishedReason.OutOfLives && lives !== 0) {
		hydrationError('games finished from lost lives must have zero lives.');
	}
	if (finishedReason === HanabiFinishedReason.OutOfTurns && remainingTurns !== 0) {
		hydrationError('games finished from exhausted turns must have zero remaining turns.');
	}

	const tiles = requireRecord(data.tiles, 'data.tiles');
	const tileIds = new Set(Object.keys(tiles));
	if (tileIds.size > 60) hydrationError('data.tiles must contain at most 60 tiles.');
	const allowedColors =
		ruleSet === '5-color'
			? TILE_COLORS.slice(0, 5)
			: ruleSet === '6-color'
				? TILE_COLORS.slice(0, 6)
				: [...TILE_COLORS.slice(0, 5), 'rainbow' as const];
	for (const [id, tile] of Object.entries(tiles)) {
		validateTile(tile, `data.tiles.${id}`);
		const tileRecord = tile as Record<string, unknown>;
		if (tileRecord.id !== id) hydrationError(`data.tiles.${id}.id must match its map key.`);
		requireOneOf(tileRecord.color, allowedColors, `data.tiles.${id}.color`);
	}
	const tileClaims = new Set<string>();
	const claimTiles = (ids: string[], path: string): void => {
		for (const id of ids) {
			if (!tileIds.has(id)) hydrationError(`${path} references unknown tile "${id}".`);
			if (tileClaims.has(id)) hydrationError(`tile "${id}" appears in more than one zone.`);
			tileClaims.add(id);
		}
	};
	claimTiles(
		validateStringArray(data.remainingTiles, 'data.remainingTiles'),
		'data.remainingTiles',
	);
	claimTiles(validateStringArray(data.playedTiles, 'data.playedTiles'), 'data.playedTiles');
	claimTiles(
		validateStringArray(data.discardedTiles, 'data.discardedTiles'),
		'data.discardedTiles',
	);

	const playerTiles = requireRecord(data.playerTiles, 'data.playerTiles');
	for (const [id, tileIds] of Object.entries(playerTiles)) {
		if (!players[id]) hydrationError(`data.playerTiles.${id} references an unknown player.`);
		claimTiles(validateStringArray(tileIds, `data.playerTiles.${id}`), `data.playerTiles.${id}`);
	}
	if (stage !== HanabiStage.Setup) {
		if (Object.keys(playerTiles).length !== playerIds.length || tileClaims.size !== tileIds.size) {
			hydrationError('started games must assign every player and tile to exactly one zone.');
		}
	} else if (tileIds.size !== 0 || Object.keys(playerTiles).length !== 0) {
		hydrationError('setup games cannot contain dealt tiles.');
	}
	const tilePositions = requireRecord(data.tilePositions, 'data.tilePositions');
	for (const [id, value] of Object.entries(tilePositions)) {
		if (!tileIds.has(id)) hydrationError(`data.tilePositions.${id} references an unknown tile.`);
		const position = requireRecord(value, `data.tilePositions.${id}`);
		requireFiniteNumber(position.x, `data.tilePositions.${id}.x`);
		requireFiniteNumber(position.y, `data.tilePositions.${id}.y`);
		requireFiniteNumber(position.z, `data.tilePositions.${id}.z`);
	}
	const tileNotes = requireRecord(data.tileNotes, 'data.tileNotes');
	for (const [id, value] of Object.entries(tileNotes)) {
		if (!tileIds.has(id)) hydrationError(`data.tileNotes.${id} references an unknown tile.`);
		const notes = requireRecord(value, `data.tileNotes.${id}`);
		requireArray(notes.colors, `data.tileNotes.${id}.colors`).forEach((color, index) =>
			requireOneOf(color, TILE_COLORS, `data.tileNotes.${id}.colors[${index}]`),
		);
		requireArray(notes.numbers, `data.tileNotes.${id}.numbers`).forEach((number, index) =>
			requireOneOf(number, TILE_NUMBERS, `data.tileNotes.${id}.numbers[${index}]`),
		);
	}

	const actions = requireArray(data.actions, 'data.actions');
	const retainedActions = actions.slice(-HANABI_MAX_ACTIONS);
	retainedActions.forEach((action, index) => validateAction(action, `data.actions[${index}]`));
	data.actions = retainedActions;
}

function parsePersistedGame(value: string): HanabiGameSerialized {
	if (Buffer.byteLength(value, 'utf8') > MAX_LEGACY_PERSISTED_GAME_BYTES) {
		hydrationError(`persisted data exceeds ${MAX_LEGACY_PERSISTED_GAME_BYTES} bytes.`);
	}
	let parsed: unknown;
	try {
		parsed = JSON.parse(value);
	} catch {
		hydrationError('persisted data is not valid JSON.');
	}
	const game = requireRecord(parsed, 'game');
	requireString(game.id, 'id');
	requireString(game.code, 'code');
	requireString(game.creatorId, 'creatorId');
	for (const field of ['created', 'updated'] as const) {
		const date = requireString(game[field], field);
		if (Number.isNaN(Date.parse(date))) {
			hydrationError(`${field} must be a valid date string.`);
		}
	}
	validateGameData(game.data);
	if (Buffer.byteLength(JSON.stringify(game), 'utf8') > MAX_PERSISTED_GAME_BYTES) {
		hydrationError(`normalized persisted data exceeds ${MAX_PERSISTED_GAME_BYTES} bytes.`);
	}
	return game as unknown as HanabiGameSerialized;
}

export default class HanabiGameFactory extends GameFactory {
	constructor(private readonly _minimumPlayers = HANABI_MIN_PLAYERS) {
		super();
	}

	public get title(): string {
		return HANABI_GAME_TITLE;
	}

	public create(
		creatorId: string,
		socketManager: ServerSocketManager,
		saveGameDelegate: SaveGameDelegate,
	): HanabiGame {
		return new HanabiGame(creatorId, socketManager, saveGameDelegate, this._minimumPlayers);
	}

	public hydrate(
		data: string,
		socketManager: ServerSocketManager,
		saveGameDelegate: SaveGameDelegate,
	): HanabiGame {
		return new HanabiGame(
			parsePersistedGame(data),
			socketManager,
			saveGameDelegate,
			this._minimumPlayers,
		);
	}
}
