import { isDeepStrictEqual } from 'node:util';
import {
	HANABI_CLUE_COLORS,
	HANABI_GAME_TITLE,
	HANABI_MAX_ACTIONS,
	HANABI_MAX_CHAT_LENGTH,
	HANABI_MAX_CLUES,
	HANABI_MAX_LIVES,
	HANABI_MAX_PLAYERS,
	HANABI_MIN_PLAYERS,
	HANABI_RULE_SETS,
	HANABI_TILE_COLORS,
	HanabiFinishedReason,
	HanabiGameActionType,
	HanabiStage,
	getHanabiRuleSetColors,
	doesHanabiTileMatchClue,
	getHanabiScore,
	normalizeLegacyHanabiTilePositions,
	type HanabiGameData,
	type HanabiTile,
	type Position,
} from '@hanabi/shared';
import HanabiGame, { HanabiGameSerialized } from './HanabiGame.js';
import GameFactory from '../server/GameFactory.js';
import { SaveGameDelegate } from '../server/GameStore.js';
import ServerSocketManager from '../../utils/SocketManager.js';
import { GameTranscriptRecorder, NOOP_GAME_TRANSCRIPT_RECORDER } from './GameTranscriptRecorder.js';
import { BotRuntime } from './bots/BotRuntime.js';
import { isBotRound, removeBotScratchpad, type BotRound } from './bots/BotRound.js';
import type { BotCardReference, BotHistoryPublicState } from './bots/BotHistory.js';
import { getBotRules } from './bots/BotRules.js';
import { BOT_DEBUG_CHAT_PREFIX, MAX_BOT_DEBUG_CHAT_LENGTH } from './bots/BotDecisionChat.js';

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
	requireOneOf(tile.color, HANABI_TILE_COLORS, `${path}.color`);
	requireOneOf(tile.number, TILE_NUMBERS, `${path}.number`);
}

function validateAction(value: unknown, path: string, botPlayerIds: ReadonlySet<string>): void {
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
			requireOneOf(action.color, HANABI_CLUE_COLORS, `${path}.color`);
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
			const playerId = requireString(action.playerId, `${path}.playerId`);
			const message = requireString(action.message, `${path}.message`);
			const maxLength =
				botPlayerIds.has(playerId) && message.startsWith(BOT_DEBUG_CHAT_PREFIX)
					? MAX_BOT_DEBUG_CHAT_LENGTH
					: HANABI_MAX_CHAT_LENGTH;
			if (!message.trim() || message.length > maxLength) {
				hydrationError(`${path}.message must contain between 1 and ${maxLength} characters.`);
			}
			break;
		}
	}
}

function validateGameData(value: unknown): void {
	const data = requireRecord(value, 'data');
	requireString(data.seed, 'data.seed');
	const ruleSet = requireOneOf(data.ruleSet, HANABI_RULE_SETS, 'data.ruleSet');
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
	const botPlayerIds = new Set<string>();
	if (playerIds.length > HANABI_MAX_PLAYERS) {
		hydrationError(`data.players must contain at most ${HANABI_MAX_PLAYERS} players.`);
	}
	for (const [id, value] of Object.entries(players)) {
		const player = requireRecord(value, `data.players.${id}`);
		if (requireString(player.id, `data.players.${id}.id`) !== id) {
			hydrationError(`data.players.${id}.id must match its map key.`);
		}
		requireBoolean(player.connected, `data.players.${id}.connected`);
		if (player.kind !== undefined)
			requireOneOf(player.kind, ['human', 'bot'], `data.players.${id}.kind`);
		if ((player.kind === 'bot') !== id.startsWith('bot:'))
			hydrationError('Bot player ids must match their player kind.');
		if (player.kind === 'bot') botPlayerIds.add(id);
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
	const allowedColors = getHanabiRuleSetColors(ruleSet);
	const maximumTiles = allowedColors.length * 10;
	if (tileIds.size > maximumTiles) {
		hydrationError(`data.tiles must contain at most ${maximumTiles} tiles.`);
	}
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
	const validatedTilePositions: Record<string, { x: number; y: number; z: number }> = {};
	for (const [id, value] of Object.entries(tilePositions)) {
		if (!tileIds.has(id)) hydrationError(`data.tilePositions.${id} references an unknown tile.`);
		const position = requireRecord(value, `data.tilePositions.${id}`);
		validatedTilePositions[id] = {
			x: requireFiniteNumber(position.x, `data.tilePositions.${id}.x`),
			y: requireFiniteNumber(position.y, `data.tilePositions.${id}.y`),
			z: requireFiniteNumber(position.z, `data.tilePositions.${id}.z`),
		};
	}
	data.tilePositions = normalizeLegacyHanabiTilePositions(validatedTilePositions);
	const tileNotes = requireRecord(data.tileNotes, 'data.tileNotes');
	for (const [id, value] of Object.entries(tileNotes)) {
		if (!tileIds.has(id)) hydrationError(`data.tileNotes.${id} references an unknown tile.`);
		const notes = requireRecord(value, `data.tileNotes.${id}`);
		requireArray(notes.colors, `data.tileNotes.${id}.colors`).forEach((color, index) =>
			requireOneOf(color, HANABI_CLUE_COLORS, `data.tileNotes.${id}.colors[${index}]`),
		);
		requireArray(notes.numbers, `data.tileNotes.${id}.numbers`).forEach((number, index) =>
			requireOneOf(number, TILE_NUMBERS, `data.tileNotes.${id}.numbers[${index}]`),
		);
	}

	const actions = requireArray(data.actions, 'data.actions');
	const retainedActions = actions.slice(-HANABI_MAX_ACTIONS);
	retainedActions.forEach((action, index) =>
		validateAction(action, `data.actions[${index}]`, botPlayerIds),
	);
	data.actions = retainedActions;
}

/** Validated private histories may grow beyond ordinary game-envelope limits. */
function withoutBotRecords(game: Record<string, unknown>, round: BotRound | null) {
	return round?.version === 2
		? {
				...game,
				botRound: {
					...round,
					history: undefined,
				},
			}
		: game;
}

function validateV2Round(round: BotRound, data: HanabiGameData): void {
	if (round.version !== 2 || round.history.version !== 2) return;
	const history = round.history;
	if (!isDeepStrictEqual(round.policy.rules, getBotRules(data))) {
		hydrationError('botRound rules must match the current game mode and options.');
	}
	const sameIds = (a: readonly string[], b: readonly string[]) =>
		a.length === b.length && new Set(a).size === a.length && a.every((id) => b.includes(id));
	if (
		!sameIds(
			history.initialHands.map(({ playerId }) => playerId),
			data.turnOrder,
		)
	) {
		hydrationError('botRound history must contain every current player.');
	}
	const checkFace = (tileId: string, face: Pick<HanabiTile, 'color' | 'number'>) => {
		const actual = data.tiles[tileId];
		if (!actual || face.color !== actual.color || face.number !== actual.number) {
			hydrationError('botRound history contains a card inconsistent with the saved deck.');
		}
	};
	const checkPublicTiles = (state: BotHistoryPublicState) => {
		for (const tile of [...state.playedTiles, ...state.discardedTiles]) checkFace(tile.id, tile);
	};
	const references = new Map<string, BotCardReference[]>();
	for (const hand of history.initialHands) {
		references.set(hand.playerId, hand.cards);
		for (const card of hand.cards) checkFace(card.tileId, card.face);
	}
	let publicState = structuredClone(history.initialState);
	checkPublicTiles(publicState);
	for (const event of history.events) {
		if (event.type === 'arrangement') {
			if (
				history.layoutHistoryComplete &&
				!isDeepStrictEqual(
					event.before,
					references.get(event.actorId)?.map(({ tileId, position }) => ({ tileId, position })),
				)
			) {
				hydrationError('botRound arrangement does not follow the recorded hand layout.');
			}
			references.set(event.actorId, event.after);
			continue;
		}
		if (event.type === 'clue') {
			if (!isDeepStrictEqual(event.beforeState, publicState)) {
				hydrationError('botRound clue context does not match the preceding public state.');
			}
			const matching = event.hand
				.filter(({ tileId }) =>
					doesHanabiTileMatchClue(
						data.tiles[tileId],
						data.ruleSet,
						event.clue.type === 'color'
							? { color: event.clue.value }
							: { number: event.clue.value },
					),
				)
				.map(({ tileId }) => tileId);
			if (!sameIds(matching, event.touchedTileIds)) {
				hydrationError('botRound clue evidence does not match the recorded cards.');
			}
			if (
				history.layoutHistoryComplete &&
				!isDeepStrictEqual(
					event.hand,
					references.get(event.recipientId)?.map(({ tileId, position }) => ({ tileId, position })),
				)
			) {
				hydrationError('botRound clue does not match the recorded recipient layout.');
			}
		} else {
			checkFace(event.tile.id, event.tile);
			for (const card of event.drawnTiles) checkFace(card.tileId, card.face);
			references.set(event.actorId, event.handAfter);
			if (event.type === 'play' && event.valid) publicState.playedTiles.push(event.tile);
			else publicState.discardedTiles.push(event.tile);
		}
		publicState = { ...publicState, ...event.postTurn };
	}
	const finalPublicState: BotHistoryPublicState = {
		currentPlayerId: data.currentPlayerId,
		clues: data.clues,
		lives: data.lives,
		remainingTurns: data.remainingTurns,
		deckCount: data.remainingTiles.length,
		score: getHanabiScore(data),
		stage: data.stage,
		finishedReason: data.finishedReason,
		playedTiles: data.playedTiles.map((id) => ({
			id,
			color: data.tiles[id].color,
			number: data.tiles[id].number,
		})),
		discardedTiles: data.discardedTiles.map((id) => ({
			id,
			color: data.tiles[id].color,
			number: data.tiles[id].number,
		})),
	};
	if (!isDeepStrictEqual(publicState, finalPublicState)) {
		hydrationError('botRound history does not match the current board or turn resources.');
	}
	for (const playerId of data.turnOrder) {
		const hand = references.get(playerId)!;
		if (
			!isDeepStrictEqual(
				hand.map(({ tileId }) => tileId),
				data.playerTiles[playerId],
			)
		) {
			hydrationError('botRound history does not match the current player hands.');
		}
		if (history.layoutHistoryComplete) {
			const recordedPositions: Record<string, Position> = {};
			for (const card of hand) if (card.position) recordedPositions[card.tileId] = card.position;
			const currentPositions = Object.fromEntries(
				hand.flatMap(({ tileId }) =>
					data.tilePositions[tileId] ? [[tileId, data.tilePositions[tileId]]] : [],
				),
			);
			if (
				!isDeepStrictEqual(normalizeLegacyHanabiTilePositions(recordedPositions), currentPositions)
			) {
				hydrationError('botRound history does not match the current card layout.');
			}
		}
	}
	const clueEvents = new Map(
		history.events.filter((event) => event.type === 'clue').map((event) => [event.eventId, event]),
	);
	for (const pending of round.pendingClues ?? []) {
		if (
			data.players[pending.playerId]?.kind !== 'bot' ||
			!round.policy.arrangementAfterClue ||
			!data.allowDragging ||
			pending.eventIds.some((id) => clueEvents.get(id)?.recipientId !== pending.playerId)
		) {
			hydrationError('botRound pending clues must reference actual clues for an eligible bot.');
		}
	}
	for (const pending of [
		...(round.pendingResult ? [round.pendingResult] : []),
		...(round.pendingResults ?? []),
	]) {
		const source = history.events.find((event) => event.eventId === pending.eventId);
		if (
			!round.policy.reflectionAfterAction ||
			data.players[pending.playerId]?.kind !== 'bot' ||
			(source?.type !== 'play' && source?.type !== 'discard') ||
			source.actorId !== pending.playerId ||
			history.events.some(
				(event) =>
					event.sequence > source.sequence &&
					event.type !== 'arrangement' &&
					event.actorId === pending.playerId,
			)
		) {
			hydrationError(
				'botRound pending result must reference an unprocessed play or discard by its bot.',
			);
		}
	}
	// Work queued before another actor finishes the game is no longer an eligible opportunity.
	if (data.stage === HanabiStage.Finished) round.pendingClues = [];
}

function parsePersistedGame(value: string): HanabiGameSerialized {
	let parsed: unknown;
	try {
		parsed = JSON.parse(value);
	} catch {
		hydrationError('persisted data is not valid JSON.');
	}
	const game = requireRecord(parsed, 'game');
	let round: BotRound | null = null;
	if (game.botRound !== undefined && game.botRound !== null) {
		if (!isBotRound(game.botRound))
			hydrationError('botRound must contain valid state for the current round.');
		round = removeBotScratchpad(game.botRound);
		game.botRound = round;
	}
	const rawEnvelopeBytes =
		round?.version === 2
			? Buffer.byteLength(JSON.stringify(withoutBotRecords(game, round)), 'utf8')
			: Buffer.byteLength(value, 'utf8');
	if (rawEnvelopeBytes > MAX_LEGACY_PERSISTED_GAME_BYTES) {
		hydrationError(`persisted data exceeds ${MAX_LEGACY_PERSISTED_GAME_BYTES} bytes.`);
	}
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
	const data = game.data as HanabiGameSerialized['data'];
	delete data.bots;
	if (round) {
		if (round.roundId !== data.seed || data.stage === HanabiStage.Setup) {
			hydrationError('botRound must contain valid state for the current round.');
		}
		validateV2Round(round, data);
	}
	if (
		data.stage !== HanabiStage.Setup &&
		Object.values(data.players).some((player) => player.kind === 'bot') &&
		!game.botRound
	) {
		hydrationError('Started bot games must preserve their bot round.');
	}
	if (
		Buffer.byteLength(JSON.stringify(withoutBotRecords(game, round)), 'utf8') >
		MAX_PERSISTED_GAME_BYTES
	) {
		hydrationError(`normalized persisted data exceeds ${MAX_PERSISTED_GAME_BYTES} bytes.`);
	}
	return game as unknown as HanabiGameSerialized;
}

export default class HanabiGameFactory extends GameFactory {
	constructor(
		private readonly _minimumPlayers = HANABI_MIN_PLAYERS,
		private readonly _debugPlayerControls = false,
		private readonly _transcriptRecorder: GameTranscriptRecorder = NOOP_GAME_TRANSCRIPT_RECORDER,
		private readonly _botRuntime?: BotRuntime,
	) {
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
		return new HanabiGame(
			creatorId,
			socketManager,
			saveGameDelegate,
			this._minimumPlayers,
			this._debugPlayerControls,
			this._transcriptRecorder,
			this._botRuntime,
		);
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
			this._debugPlayerControls,
			this._transcriptRecorder,
			this._botRuntime,
		);
	}
}
