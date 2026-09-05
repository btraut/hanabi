import {
	getHanabiClueColors,
	getHanabiFireworkSequence,
	getHanabiHandLayout,
	getHanabiMaxScore,
	getHanabiRuleSetColors,
	getHanabiScore,
	HANABI_BOARD_SIZE,
	HANABI_MAX_CLUES,
	HANABI_MAX_LIVES,
	HANABI_WORKSPACE_ZONE_BOUNDARY,
	type HanabiClueColor,
	type HanabiGameData,
	type HanabiTile,
	type HanabiTileNumber,
	type Position,
} from '@hanabi/shared';
import {
	botCardReference,
	type BotCardReference,
	type BotHistory,
	type BotHistoryCard,
	type BotHistoryMove,
	type BotHistoryPostTurn,
	type BotHistoryPublicState,
	type BotHistoryEvent,
} from './BotHistory.js';
import { getBotLegalActions } from './BotLegalActions.js';
import {
	botClueChanges,
	botClueEvidence,
	botPossibleIdentities,
	botPublicRemainingCopies,
	type BotKnowledgeClue,
} from './BotKnowledge.js';
import { getBotRules } from './BotRules.js';

function reference(card: BotCardReference): BotCardReference {
	return {
		tileId: card.tileId,
		position: card.position ? { x: card.position.x, y: card.position.y, z: card.position.z } : null,
	};
}

function face(tile: Pick<HanabiTile, 'color' | 'number'>) {
	return { color: tile.color, number: tile.number };
}

function observedHistoryCard(card: BotHistoryCard, ownerId: string, botId: string) {
	return { ...reference(card), face: ownerId === botId ? null : face(card.face) };
}

function postTurn(turn: BotHistoryPostTurn): BotHistoryPostTurn {
	return {
		currentPlayerId: turn.currentPlayerId,
		clues: turn.clues,
		lives: turn.lives,
		remainingTurns: turn.remainingTurns,
		deckCount: turn.deckCount,
		score: turn.score,
		stage: turn.stage,
		finishedReason: turn.finishedReason,
	};
}

function observedMove(move: BotHistoryMove, botId: string) {
	const base = {
		actionId: move.actionId,
		actorId: move.actorId,
		postTurn: postTurn(move.postTurn),
	};
	if (move.type === 'clue') {
		return {
			...base,
			type: 'clue' as const,
			recipientId: move.recipientId,
			clue:
				move.clue.type === 'color'
					? { type: 'color' as const, value: move.clue.value }
					: { type: 'number' as const, value: move.clue.value },
			hand: move.hand.map(reference),
			touchedTileIds: [...move.touchedTileIds],
			untouchedTileIds: [...move.untouchedTileIds],
		};
	}
	return {
		...base,
		type: move.type,
		tile: { tileId: move.tile.id, ...face(move.tile) },
		...(move.type === 'play' ? { valid: move.valid } : {}),
		drawnTiles: move.drawnTiles.map((card) => observedHistoryCard(card, move.actorId, botId)),
		handAfter: move.handAfter.map(reference),
	};
}

function cardClues(
	gameData: HanabiGameData,
	history: BotHistory | null | undefined,
	tileId: string,
) {
	const matchingColors = new Set<HanabiClueColor>();
	const matchingNumbers = new Set<HanabiTileNumber>();
	const excludedColors = new Set<HanabiClueColor>();
	const excludedNumbers = new Set<HanabiTileNumber>();
	if (gameData.showNotes) {
		for (const color of gameData.tileNotes[tileId]?.colors ?? []) matchingColors.add(color);
		for (const number of gameData.tileNotes[tileId]?.numbers ?? []) matchingNumbers.add(number);
	}
	for (const move of history?.moves ?? []) {
		if (move.type !== 'clue') continue;
		const touched = move.touchedTileIds.includes(tileId);
		const untouched = move.untouchedTileIds.includes(tileId);
		if (move.clue.type === 'color') {
			if (touched) matchingColors.add(move.clue.value);
			if (untouched) excludedColors.add(move.clue.value);
		} else {
			if (touched) matchingNumbers.add(move.clue.value);
			if (untouched) excludedNumbers.add(move.clue.value);
		}
	}
	return {
		matchingColors: [...matchingColors],
		matchingNumbers: [...matchingNumbers],
		excludedColors: [...excludedColors],
		excludedNumbers: [...excludedNumbers],
	};
}

/**
 * This allowlist is the inference privacy boundary. Never substitute a recipient
 * snapshot: its concealed tile dictionary still carries privileged insertion order.
 */
function buildLegacyBotObservation(
	gameData: HanabiGameData,
	botId: string,
	history?: BotHistory | null,
) {
	if (!Object.hasOwn(gameData.players, botId)) {
		throw new Error('A bot observation requires a seated player.');
	}
	const colors = getHanabiRuleSetColors(gameData.ruleSet);
	return {
		version: 1 as const,
		playerId: botId,
		rules: {
			ruleSet: gameData.ruleSet,
			allowDragging: gameData.allowDragging,
			showNotes: gameData.showNotes,
			criticalGameOver: gameData.criticalGameOver,
			maxClues: HANABI_MAX_CLUES,
			maxLives: HANABI_MAX_LIVES,
			maxScore: getHanabiMaxScore(gameData.ruleSet),
			colorClues: [...getHanabiClueColors(gameData.ruleSet)],
			suits: colors.map((color) => ({
				color,
				playSequence: [...getHanabiFireworkSequence(color)],
				copies: [1, 2, 3, 4, 5].map((number) => ({
					number,
					count:
						color === 'black'
							? number === 5
								? 3
								: number === 1
									? 1
									: 2
							: number === 1
								? 3
								: number === 5
									? 1
									: 2,
				})),
			})),
		},
		board: {
			width: HANABI_BOARD_SIZE.width,
			height: HANABI_BOARD_SIZE.height,
			topHalfBoundaryY: HANABI_WORKSPACE_ZONE_BOUNDARY,
			handOrder:
				'Hand arrays use stable membership order; x/y positions show the visible arrangement.',
		},
		stage: gameData.stage,
		finishedReason: gameData.finishedReason,
		currentPlayerId: gameData.currentPlayerId,
		turnOrder: [...gameData.turnOrder],
		remainingTurns: gameData.remainingTurns,
		clues: gameData.clues,
		lives: gameData.lives,
		score: getHanabiScore(gameData),
		deckCount: gameData.remainingTiles.length,
		players: gameData.turnOrder.map((playerId) => ({
			id: playerId,
			name: gameData.players[playerId].name,
			hand: (gameData.playerTiles[playerId] ?? []).map((tileId) => ({
				...botCardReference(gameData, tileId),
				face: playerId === botId ? null : face(gameData.tiles[tileId]),
				clueKnowledge: cardClues(gameData, history, tileId),
			})),
		})),
		fireworks: colors.map((color) => ({
			color,
			tiles: gameData.playedTiles
				.filter((tileId) => gameData.tiles[tileId].color === color)
				.map((tileId) => ({ tileId, ...face(gameData.tiles[tileId]) })),
		})),
		discards: gameData.discardedTiles.map((tileId) => ({
			tileId,
			...face(gameData.tiles[tileId]),
		})),
		history: {
			complete: history?.complete ?? false,
			initialHands: (history?.initialHands ?? []).map((hand) => ({
				playerId: hand.playerId,
				cards: hand.cards.map((card) => observedHistoryCard(card, hand.playerId, botId)),
			})),
			moves: (history?.moves ?? []).map((move) => observedMove(move, botId)),
		},
		legalActions: getBotLegalActions(gameData, botId),
	};
}

function layout(cards: readonly BotCardReference[]) {
	const positions: Record<string, Position> = {};
	for (const card of cards) {
		if (card.position) positions[card.tileId] = { ...card.position };
	}
	return getHanabiHandLayout(
		cards.map(({ tileId }) => tileId),
		positions,
	);
}

function observedPublicState(state: BotHistoryPublicState) {
	return {
		...postTurn(state),
		playedTiles: state.playedTiles.map((tile) => ({ tileId: tile.id, ...face(tile) })),
		discardedTiles: state.discardedTiles.map((tile) => ({ tileId: tile.id, ...face(tile) })),
	};
}

function observedEvent(event: BotHistoryEvent, botId: string) {
	const order = { eventId: event.eventId, sequence: event.sequence, turnIndex: event.turnIndex };
	if (event.type === 'arrangement') {
		return {
			...order,
			type: 'arrangement' as const,
			actorId: event.actorId,
			before: { cards: event.before.map(reference), layout: layout(event.before) },
			after: { cards: event.after.map(reference), layout: layout(event.after) },
			changedTileIds: [...event.changedTileIds],
			...(event.sourceClueEventId === undefined
				? {}
				: { sourceClueEventId: event.sourceClueEventId }),
		};
	}
	const move = observedMove(event, botId);
	if (move.type === 'clue') {
		return {
			...order,
			...move,
			beforeState: event.beforeState ? observedPublicState(event.beforeState) : null,
			recipientLayout: layout(move.hand),
			touchedCount: move.touchedTileIds.length,
		};
	}
	return { ...order, ...move, layoutAfter: layout(move.handAfter) };
}

function buildEnrichedBotObservation(
	gameData: HanabiGameData,
	botId: string,
	history?: BotHistory | null,
) {
	// Complete the privacy projection before deriving any identity, clue metadata, or belief.
	const projected = buildLegacyBotObservation(gameData, botId, history);
	const projectedEvents =
		history?.version === 2
			? history.events.map((event) => observedEvent(event, botId))
			: (history?.moves ?? []).map((move, index) =>
					observedEvent(
						{
							...move,
							eventId: move.actionId,
							sequence: index + 1,
							turnIndex: index + 1,
						},
						botId,
					),
				);
	const rules = getBotRules(gameData);
	const priorClues: BotKnowledgeClue[] = [];
	const events = projectedEvents.map((event) => {
		if (event.type !== 'clue') return event;
		const knowledgeChanges = botClueChanges(gameData.ruleSet, event, priorClues);
		priorClues.push(event);
		return { ...event, knowledgeChanges };
	});
	const publicRemainingCopies = botPublicRemainingCopies(
		rules.suits,
		projected.fireworks.flatMap(({ tiles }) => tiles),
		projected.discards,
	);
	const visibleOtherCards = projected.players.flatMap(({ id, hand }) =>
		id === botId ? [] : hand.flatMap((card) => (card.face ? [card.face] : [])),
	);
	const arrivals = new Map<string, string>();
	for (const hand of projected.history.initialHands) {
		for (const card of hand.cards) arrivals.set(card.tileId, 'initial');
	}
	for (const event of events) {
		if (event.type !== 'play' && event.type !== 'discard') continue;
		for (const card of event.drawnTiles) arrivals.set(card.tileId, event.eventId);
	}
	const { history: legacyHistory, ...current } = projected;
	return {
		...current,
		version: 2 as const,
		rules,
		board: {
			...current.board,
			handOrder:
				'layout.orderedRow is the upper row from left to right; lowerArea contains free placements with normalized x/y and back-to-front stackOrder. Hand arrays use stable membership order.',
		},
		players: projected.players.map((player) => {
			const handLayout = layout(player.hand);
			return {
				id: player.id,
				name: player.name,
				layout: handLayout,
				hand: player.hand.map((card) => {
					const rowSlot = handLayout.orderedRow.indexOf(card.tileId);
					const evidence = botClueEvidence(card.tileId, priorClues);
					return {
						...card,
						zone: rowSlot >= 0 ? ('orderedRow' as const) : ('lowerArea' as const),
						rowSlot: rowSlot >= 0 ? rowSlot : null,
						arrivalEventId: arrivals.get(card.tileId) ?? null,
						clueKnowledge: {
							...card.clueKnowledge,
							evidence,
							possibleIdentities: botPossibleIdentities(
								gameData.ruleSet,
								evidence,
								publicRemainingCopies,
							),
							...(player.id === botId
								? {
										observerPossibleIdentities: botPossibleIdentities(
											gameData.ruleSet,
											evidence,
											publicRemainingCopies,
											visibleOtherCards,
										),
									}
								: {}),
						},
					};
				}),
			};
		}),
		publicRemainingCopies,
		history: {
			complete: history?.version === 2 ? history.complete : false,
			turnHistoryComplete:
				history?.version === 2 ? history.turnHistoryComplete : (history?.complete ?? false),
			layoutHistoryComplete: history?.version === 2 ? history.layoutHistoryComplete : false,
			initialState: history?.version === 2 ? observedPublicState(history.initialState) : null,
			initialHands: legacyHistory.initialHands.map((hand) => ({
				...hand,
				layout: layout(hand.cards),
			})),
			events,
		},
	};
}

export function buildBotObservation(
	gameData: HanabiGameData,
	botId: string,
	history: BotHistory | null | undefined,
	contractVersion: 2,
): ReturnType<typeof buildEnrichedBotObservation>;
export function buildBotObservation(
	gameData: HanabiGameData,
	botId: string,
	history?: BotHistory | null,
	contractVersion?: 1,
): ReturnType<typeof buildLegacyBotObservation>;
export function buildBotObservation(
	gameData: HanabiGameData,
	botId: string,
	history: BotHistory | null | undefined,
	contractVersion: 1 | 2,
): BotObservation;
export function buildBotObservation(
	gameData: HanabiGameData,
	botId: string,
	history?: BotHistory | null,
	contractVersion: 1 | 2 = 1,
): BotObservation {
	return contractVersion === 1
		? buildLegacyBotObservation(gameData, botId, history)
		: buildEnrichedBotObservation(gameData, botId, history);
}

export type BotObservation =
	ReturnType<typeof buildLegacyBotObservation> | ReturnType<typeof buildEnrichedBotObservation>;
