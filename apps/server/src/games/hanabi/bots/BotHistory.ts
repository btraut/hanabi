import { isDeepStrictEqual } from 'node:util';
import {
	getHanabiScore,
	HANABI_CLUE_COLORS,
	HANABI_MAX_PLAYERS,
	HANABI_TILE_COLORS,
	HanabiFinishedReason,
	HanabiGameActionType,
	HanabiStage,
	type HanabiClueColor,
	type HanabiGameAction,
	type HanabiGameData,
	type HanabiTile,
	type HanabiTileNumber,
	type Position,
} from '@hanabi/shared';

export interface BotCardReference {
	tileId: string;
	position: Position | null;
}

export interface BotHistoryCard extends BotCardReference {
	face: Pick<HanabiTile, 'color' | 'number'>;
}

export interface BotHistoryHand {
	playerId: string;
	cards: BotHistoryCard[];
}

export type BotClue =
	{ type: 'color'; value: HanabiClueColor } | { type: 'number'; value: HanabiTileNumber };

export interface BotHistoryPostTurn {
	currentPlayerId: string | null;
	clues: number;
	lives: number;
	remainingTurns: number | null;
	deckCount: number;
	score: number;
	stage: HanabiStage;
	finishedReason: HanabiFinishedReason | null;
}

interface BotHistoryMoveBase {
	actionId: string;
	actorId: string;
	postTurn: BotHistoryPostTurn;
}

export type BotHistoryMove = BotHistoryMoveBase &
	(
		| {
				type: 'play';
				tile: HanabiTile;
				valid: boolean;
				drawnTiles: BotHistoryCard[];
				handAfter: BotCardReference[];
		  }
		| {
				type: 'discard';
				tile: HanabiTile;
				drawnTiles: BotHistoryCard[];
				handAfter: BotCardReference[];
		  }
		| {
				type: 'clue';
				recipientId: string;
				clue: BotClue;
				hand: BotCardReference[];
				touchedTileIds: string[];
				untouchedTileIds: string[];
		  }
	);

/** Private server record. Always project through buildBotObservation before inference. */
export interface BotHistoryV1 {
	version: 1;
	complete: boolean;
	initialHands: BotHistoryHand[];
	moves: BotHistoryMove[];
}

export interface BotHistoryPublicState extends BotHistoryPostTurn {
	playedTiles: HanabiTile[];
	discardedTiles: HanabiTile[];
}

interface BotHistoryEventOrder {
	eventId: string;
	sequence: number;
	/** Number of completed gameplay turns at this event. Arrangements do not advance it. */
	turnIndex: number;
}

export type BotHistoryTurnEvent = BotHistoryMove &
	BotHistoryEventOrder & {
		/** The public board and resources immediately before this clue. */
		beforeState?: BotHistoryPublicState;
	};

export interface BotHistoryArrangement extends BotHistoryEventOrder {
	type: 'arrangement';
	actorId: string;
	before: BotCardReference[];
	after: BotCardReference[];
	changedTileIds: string[];
	sourceClueEventId?: string;
}

export type BotHistoryEvent = BotHistoryTurnEvent | BotHistoryArrangement;

/** Private faces occur only in deals/draws and must be removed before deriving knowledge. */
export interface BotHistoryV2 {
	version: 2;
	complete: boolean;
	turnHistoryComplete: boolean;
	layoutHistoryComplete: boolean;
	initialHands: BotHistoryHand[];
	initialState: BotHistoryPublicState;
	/** Turn-only index retained for saved-round consumers. The event stream is authoritative. */
	moves: BotHistoryMove[];
	events: BotHistoryEvent[];
}

export type BotHistory = BotHistoryV1 | BotHistoryV2;

export function botCardReference(gameData: HanabiGameData, tileId: string): BotCardReference {
	const position = gameData.tilePositions[tileId];
	return {
		tileId,
		position: position ? { x: position.x, y: position.y, z: position.z } : null,
	};
}

function historyCard(gameData: HanabiGameData, tileId: string): BotHistoryCard {
	const tile = gameData.tiles[tileId];
	return {
		...botCardReference(gameData, tileId),
		face: { color: tile.color, number: tile.number },
	};
}

function publicTile(tile: HanabiTile): HanabiTile {
	return { id: tile.id, color: tile.color, number: tile.number };
}

function publicState(gameData: HanabiGameData): BotHistoryPublicState {
	return {
		currentPlayerId: gameData.currentPlayerId,
		clues: gameData.clues,
		lives: gameData.lives,
		remainingTurns: gameData.remainingTurns,
		deckCount: gameData.remainingTiles.length,
		score: getHanabiScore(gameData),
		stage: gameData.stage,
		finishedReason: gameData.finishedReason,
		playedTiles: gameData.playedTiles.map((tileId) => publicTile(gameData.tiles[tileId])),
		discardedTiles: gameData.discardedTiles.map((tileId) => publicTile(gameData.tiles[tileId])),
	};
}

export function createBotHistory(gameData: HanabiGameData, version: 2): BotHistoryV2;
export function createBotHistory(gameData: HanabiGameData, version?: 1): BotHistoryV1;
export function createBotHistory(gameData: HanabiGameData, version: 1 | 2): BotHistory;
export function createBotHistory(gameData: HanabiGameData, version: 1 | 2 = 1): BotHistory {
	const common = {
		complete: true,
		initialHands: gameData.turnOrder.map((playerId) => ({
			playerId,
			cards: (gameData.playerTiles[playerId] ?? []).map((tileId) => historyCard(gameData, tileId)),
		})),
		moves: [],
	};
	return version === 1
		? { version, ...common }
		: {
				version,
				...common,
				turnHistoryComplete: true,
				layoutHistoryComplete: true,
				initialState: publicState(gameData),
				events: [],
			};
}

function recordedHand(history: BotHistory, playerId: string): readonly BotCardReference[] {
	for (let index = history.moves.length - 1; index >= 0; index -= 1) {
		const move = history.moves[index];
		if (move.type !== 'clue' && move.actorId === playerId) return move.handAfter;
	}
	return history.initialHands.find((hand) => hand.playerId === playerId)?.cards ?? [];
}

export function appendBotHistory(
	history: BotHistory,
	action: HanabiGameAction,
	gameData: HanabiGameData,
	before?: HanabiGameData,
): BotHistory {
	if (
		!['Play', 'Discard', 'GiveColorClue', 'GiveNumberClue'].includes(action.type) ||
		history.moves.some((move) => move.actionId === action.id)
	) {
		return history;
	}
	const postTurn: BotHistoryPostTurn = {
		currentPlayerId: gameData.currentPlayerId,
		clues: gameData.clues,
		lives: gameData.lives,
		remainingTurns: gameData.remainingTurns,
		deckCount: gameData.remainingTiles.length,
		score: getHanabiScore(gameData),
		stage: gameData.stage,
		finishedReason: gameData.finishedReason,
	};
	let move: BotHistoryMove;
	switch (action.type) {
		case HanabiGameActionType.Play:
		case HanabiGameActionType.Discard: {
			const previousIds = new Set(
				recordedHand(history, action.playerId).map(({ tileId }) => tileId),
			);
			const handIds = gameData.playerTiles[action.playerId] ?? [];
			move = {
				actionId: action.id,
				actorId: action.playerId,
				postTurn,
				tile: publicTile(action.tile),
				drawnTiles: handIds
					.filter((tileId) => !previousIds.has(tileId))
					.map((tileId) => historyCard(gameData, tileId)),
				handAfter: handIds.map((tileId) => botCardReference(gameData, tileId)),
				...(action.type === HanabiGameActionType.Play
					? { type: 'play' as const, valid: action.valid }
					: { type: 'discard' as const }),
			};
			break;
		}
		case HanabiGameActionType.GiveColorClue:
		case HanabiGameActionType.GiveNumberClue: {
			const handIds = gameData.playerTiles[action.recipientId] ?? [];
			const touched = new Set(action.tiles.map(({ id }) => id));
			move = {
				type: 'clue',
				actionId: action.id,
				actorId: action.playerId,
				postTurn,
				recipientId: action.recipientId,
				clue:
					action.type === HanabiGameActionType.GiveColorClue
						? { type: 'color', value: action.color! }
						: { type: 'number', value: action.number! },
				hand: handIds.map((tileId) => botCardReference(gameData, tileId)),
				touchedTileIds: handIds.filter((tileId) => touched.has(tileId)),
				untouchedTileIds: handIds.filter((tileId) => !touched.has(tileId)),
			};
			break;
		}
		default:
			return history;
	}
	if (history.version === 2) {
		const sequence = history.events.length + 1;
		const event: BotHistoryTurnEvent = {
			...move,
			eventId: `event-${sequence}`,
			sequence,
			turnIndex: history.moves.length + 1,
		};
		if (event.type === 'clue') {
			event.beforeState = before ? publicState(before) : recordedPublicState(history);
			if (before) {
				event.hand = (before.playerTiles[event.recipientId] ?? []).map((tileId) =>
					botCardReference(before, tileId),
				);
			}
		}
		return {
			...history,
			moves: [...history.moves, move],
			events: [...history.events, event],
		};
	}
	return {
		version: 1,
		complete: history.complete,
		initialHands: history.initialHands,
		moves: [...history.moves, move],
	};
}

function recordedPublicState(history: BotHistoryV2): BotHistoryPublicState {
	let state = structuredClone(history.initialState);
	for (const move of history.moves) {
		state = { ...state, ...move.postTurn };
		if (move.type === 'clue') continue;
		if (move.type === 'play' && move.valid) state.playedTiles.push(publicTile(move.tile));
		else state.discardedTiles.push(publicTile(move.tile));
	}
	return state;
}

function samePosition(a: Position | null, b: Position | null): boolean {
	return a === b || (!!a && !!b && a.x === b.x && a.y === b.y && a.z === b.z);
}

/** Record one committed physical rearrangement, without recording pointer motion or a turn. */
export function appendBotArrangement(
	history: BotHistory,
	playerId: string,
	beforePositions: HanabiGameData['tilePositions'],
	gameData: HanabiGameData,
	sourceClueEventId?: string,
): BotHistory {
	if (history.version !== 2) return history;
	const tileIds = gameData.playerTiles[playerId] ?? [];
	const before = tileIds.map((tileId) =>
		botCardReference({ ...gameData, tilePositions: beforePositions }, tileId),
	);
	const after = tileIds.map((tileId) => botCardReference(gameData, tileId));
	const changedTileIds = tileIds.filter(
		(_, index) => !samePosition(before[index].position, after[index].position),
	);
	if (changedTileIds.length === 0) return history;
	const sequence = history.events.length + 1;
	return {
		...history,
		events: [
			...history.events,
			{
				type: 'arrangement',
				eventId: `event-${sequence}`,
				sequence,
				turnIndex: history.moves.length,
				actorId: playerId,
				before,
				after,
				changedTileIds,
				...(sourceClueEventId === undefined ? {} : { sourceClueEventId }),
			},
		],
	};
}

function object(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function finite(value: unknown): value is number {
	return typeof value === 'number' && Number.isFinite(value);
}

function validReference(value: unknown): boolean {
	if (!object(value) || typeof value.tileId !== 'string') return false;
	return (
		value.position === null ||
		(object(value.position) &&
			finite(value.position.x) &&
			finite(value.position.y) &&
			finite(value.position.z))
	);
}

function validFace(value: unknown): boolean {
	return (
		object(value) &&
		(HANABI_TILE_COLORS as readonly unknown[]).includes(value.color) &&
		[1, 2, 3, 4, 5].includes(value.number as number)
	);
}

function validCard(value: unknown): boolean {
	return validReference(value) && object(value) && validFace(value.face);
}

function list(value: unknown, validate: (item: unknown) => boolean, max: number): boolean {
	return Array.isArray(value) && value.length <= max && value.every(validate);
}

function validPostTurn(value: unknown): boolean {
	if (!object(value)) return false;
	return (
		(value.currentPlayerId === null || typeof value.currentPlayerId === 'string') &&
		finite(value.clues) &&
		finite(value.lives) &&
		finite(value.deckCount) &&
		finite(value.score) &&
		(value.remainingTurns === null || finite(value.remainingTurns)) &&
		Object.values(HanabiStage).includes(value.stage as HanabiStage) &&
		(value.finishedReason === null ||
			Object.values(HanabiFinishedReason).includes(value.finishedReason as HanabiFinishedReason))
	);
}

function validMove(value: unknown): boolean {
	if (
		!object(value) ||
		typeof value.actionId !== 'string' ||
		typeof value.actorId !== 'string' ||
		!validPostTurn(value.postTurn)
	)
		return false;
	if (value.type === 'clue') {
		const clue = value.clue;
		return (
			typeof value.recipientId === 'string' &&
			object(clue) &&
			((clue.type === 'color' && (HANABI_CLUE_COLORS as readonly unknown[]).includes(clue.value)) ||
				(clue.type === 'number' && [1, 2, 3, 4, 5].includes(clue.value as number))) &&
			list(value.hand, validReference, 5) &&
			list(value.touchedTileIds, (item) => typeof item === 'string', 5) &&
			list(value.untouchedTileIds, (item) => typeof item === 'string', 5)
		);
	}
	return (
		(value.type === 'play' || value.type === 'discard') &&
		(value.type !== 'play' || typeof value.valid === 'boolean') &&
		object(value.tile) &&
		typeof value.tile.id === 'string' &&
		validFace(value.tile) &&
		list(value.drawnTiles, validCard, 1) &&
		list(value.handAfter, validReference, 5)
	);
}

function validPublicState(value: unknown): boolean {
	const validPublicTile = (tile: unknown) =>
		object(tile) && typeof tile.id === 'string' && validFace(tile);
	return (
		object(value) &&
		validPostTurn(value) &&
		list(value.playedTiles, validPublicTile, 40) &&
		list(value.discardedTiles, validPublicTile, 80)
	);
}

function uniqueReferences(value: BotCardReference[]): boolean {
	return new Set(value.map(({ tileId }) => tileId)).size === value.length;
}

function validEvent(value: unknown): boolean {
	if (
		!object(value) ||
		typeof value.eventId !== 'string' ||
		!Number.isSafeInteger(value.sequence) ||
		(value.sequence as number) < 1 ||
		!Number.isSafeInteger(value.turnIndex) ||
		(value.turnIndex as number) < 0
	)
		return false;
	if (value.type !== 'arrangement') {
		return validMove(value) && (value.type !== 'clue' || validPublicState(value.beforeState));
	}
	if (
		typeof value.actorId !== 'string' ||
		!list(value.before, validReference, 5) ||
		!list(value.after, validReference, 5) ||
		!list(value.changedTileIds, (id) => typeof id === 'string', 5) ||
		(value.sourceClueEventId !== undefined && typeof value.sourceClueEventId !== 'string')
	)
		return false;
	const before = value.before as BotCardReference[];
	const after = value.after as BotCardReference[];
	const changed = value.changedTileIds as string[];
	if (!uniqueReferences(before) || !uniqueReferences(after) || before.length !== after.length)
		return false;
	const prior = new Map(before.map((card) => [card.tileId, card.position]));
	if (after.some(({ tileId }) => !prior.has(tileId))) return false;
	const actualChanges = after.filter(
		({ tileId, position }) => !samePosition(prior.get(tileId)!, position),
	);
	return (
		changed.length > 0 &&
		new Set(changed).size === changed.length &&
		changed.length === actualChanges.length &&
		actualChanges.every(({ tileId }) => changed.includes(tileId))
	);
}

function validV2Events(value: BotHistoryV2): boolean {
	let turnIndex = 0;
	const actionIds = new Set<string>();
	const clues = new Map<string, BotHistoryTurnEvent>();
	const hands = new Map(
		value.initialHands.map((hand) => [hand.playerId, hand.cards.map(({ tileId }) => tileId)]),
	);
	const knownCards = new Set(
		value.initialHands.flatMap((hand) => hand.cards.map(({ tileId }) => tileId)),
	);
	if (
		hands.size !== value.initialHands.length ||
		knownCards.size !== value.initialHands.reduce((sum, hand) => sum + hand.cards.length, 0)
	)
		return false;
	const sameIds = (a: readonly string[], b: readonly string[]) =>
		a.length === b.length &&
		new Set(a).size === a.length &&
		new Set(b).size === b.length &&
		a.every((id) => b.includes(id));
	for (const [index, event] of value.events.entries()) {
		if (event.sequence !== index + 1 || event.eventId !== `event-${index + 1}`) return false;
		const actorHand = hands.get(event.actorId);
		if (!actorHand) return false;
		if (event.type === 'arrangement') {
			if (
				event.turnIndex !== turnIndex ||
				!sameIds(
					actorHand,
					event.after.map(({ tileId }) => tileId),
				)
			)
				return false;
			if (event.sourceClueEventId !== undefined) {
				const source = clues.get(event.sourceClueEventId);
				if (source?.type !== 'clue' || source.recipientId !== event.actorId) return false;
			}
			continue;
		}
		const move = value.moves[turnIndex];
		const recordedMove = Object.fromEntries(
			Object.entries(event).filter(
				([key]) => !['eventId', 'sequence', 'turnIndex', 'beforeState'].includes(key),
			),
		);
		if (!move || !isDeepStrictEqual(move, recordedMove) || actionIds.has(event.actionId))
			return false;
		actionIds.add(event.actionId);
		turnIndex += 1;
		if (event.turnIndex !== turnIndex) return false;
		if (event.type === 'clue') {
			const recipientHand = hands.get(event.recipientId);
			if (
				!recipientHand ||
				!sameIds(
					recipientHand,
					event.hand.map(({ tileId }) => tileId),
				) ||
				event.touchedTileIds.length === 0 ||
				!sameIds(recipientHand, [...event.touchedTileIds, ...event.untouchedTileIds])
			)
				return false;
			clues.set(event.eventId, event);
		} else {
			const draws = event.drawnTiles.map(({ tileId }) => tileId);
			const nextHand = event.handAfter.map(({ tileId }) => tileId);
			if (
				!actorHand.includes(event.tile.id) ||
				draws.some((id) => knownCards.has(id)) ||
				!sameIds(nextHand, [...actorHand.filter((id) => id !== event.tile.id), ...draws])
			)
				return false;
			for (const id of draws) knownCards.add(id);
			hands.set(event.actorId, nextHand);
		}
	}
	return turnIndex === value.moves.length;
}

/** Validate persisted structure before it can participate in a bot observation. */
export function isBotHistory(value: unknown): value is BotHistory {
	if (
		!object(value) ||
		(value.version !== 1 && value.version !== 2) ||
		typeof value.complete !== 'boolean' ||
		!list(
			value.initialHands,
			(hand) => object(hand) && typeof hand.playerId === 'string' && list(hand.cards, validCard, 5),
			HANABI_MAX_PLAYERS,
		) ||
		!list(value.moves, validMove, value.version === 1 ? 512 : Infinity)
	)
		return false;
	if (value.version === 1) return true;
	return (
		typeof value.turnHistoryComplete === 'boolean' &&
		typeof value.layoutHistoryComplete === 'boolean' &&
		value.complete === (value.turnHistoryComplete && value.layoutHistoryComplete) &&
		validPublicState(value.initialState) &&
		list(value.events, validEvent, Infinity) &&
		validV2Events(value as unknown as BotHistoryV2)
	);
}
