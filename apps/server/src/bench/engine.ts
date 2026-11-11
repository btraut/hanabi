import {
	addToTileNotes,
	doesHanabiTileMatchClue,
	generateHanabiGameData,
	generatePlayer,
	generateRandomDeck,
	getHanabiClueColors,
	getHanabiCompletionTileCount,
	getHanabiFireworkSequence,
	getHanabiMaxScore,
	getHanabiRuleSetColors,
	getHanabiScore,
	getHanabiTileCopyCount,
	HANABI_DEFAULT_TILE_POSITIONS,
	HANABI_MAX_CLUES,
	HANABI_MAX_LIVES,
	HANABI_TILES_IN_HAND,
	HanabiFinishedReason,
	HanabiStage,
	isHanabiFireworkCompletion,
	isHanabiRuleSet,
	type DebugPlayerAction,
	type HanabiClueColor,
	type HanabiGameData,
	type HanabiRuleSet,
	type HanabiTile,
	type HanabiTileNumber,
	type Position,
} from '@hanabi/shared';
import { getBotLegalActions, type BotLegalAction } from '../games/hanabi/bots/BotLegalActions.js';

export interface BenchGameOptions {
	seed: string;
	playerCount: number;
	ruleSet: HanabiRuleSet;
	criticalGameOver: boolean;
	/** Accepted only as false for compatibility with fixed-hand configurations. */
	allowDragging?: false;
}

export interface BenchCard {
	id: string;
	face: Pick<HanabiTile, 'color' | 'number'> | null;
}

export interface BenchPublicState {
	currentPlayerId: string | null;
	clues: number;
	lives: number;
	deckCount: number;
	remainingTurns: number | null;
	score: number;
	maxScore: number;
	stage: HanabiStage;
	finishedReason: HanabiFinishedReason | null;
}

export interface BenchEvent {
	turn: number;
	playerId: string;
	action: DebugPlayerAction;
	tile?: HanabiTile;
	valid?: boolean;
	drawnCard?: BenchCard;
	touchedTileIds?: string[];
	untouchedTileIds?: string[];
	postTurn: BenchPublicState;
}

export interface BenchObservation extends BenchPublicState {
	version: 1;
	playerId: string;
	turn: number;
	ruleSet: HanabiRuleSet;
	criticalGameOver: boolean;
	turnOrder: string[];
	hands: Array<{
		playerId: string;
		cards: Array<BenchCard & { clues: { colors: HanabiClueColor[]; numbers: HanabiTileNumber[] } }>;
	}>;
	played: HanabiTile[];
	discarded: HanabiTile[];
	events: BenchEvent[];
	legalActions: BotLegalAction[];
}

export interface BenchTranscript {
	version: 1;
	options: BenchGameOptions;
	initialState: HanabiGameData;
	events: BenchEvent[];
	finalState: HanabiGameData;
}

/** A synchronous, in-memory game. State and transcripts are privileged; observations are not. */
export class BenchGame {
	private readonly options: BenchGameOptions;
	private readonly initialState: HanabiGameData;
	private readonly events: BenchEvent[] = [];
	private readonly data: HanabiGameData;

	constructor(options: BenchGameOptions) {
		if (
			typeof options.seed !== 'string' ||
			!options.seed.length ||
			!Number.isInteger(options.playerCount) ||
			options.playerCount < 2 ||
			options.playerCount > 5 ||
			!isHanabiRuleSet(options.ruleSet) ||
			typeof options.criticalGameOver !== 'boolean' ||
			(options.allowDragging !== undefined && options.allowDragging !== false)
		) {
			throw new Error(
				'Expected a seed, 2–5 players, a supported rule set, criticalGameOver, and no card movement.',
			);
		}
		this.options = { ...options };
		const [originalTiles, shuffledIds] = generateRandomDeck(options.ruleSet, options.seed);
		// Assign identities after shuffling: IDs reveal acquisition order, never suit/rank order.
		const drawOrder = [...shuffledIds].reverse().map((originalId, index) => ({
			...originalTiles[originalId],
			id: `card-${index + 1}`,
		}));
		const tiles = Object.fromEntries(drawOrder.map((tile) => [tile.id, tile]));
		const remainingTiles = drawOrder.map((tile) => tile.id).reverse();
		const turnOrder = Array.from(
			{ length: options.playerCount },
			(_, index) => `player-${index + 1}`,
		);
		const playerTiles: Record<string, string[]> = {};
		const tilePositions: Record<string, Position> = {};
		for (const playerId of turnOrder) {
			playerTiles[playerId] = Array.from(
				{ length: HANABI_TILES_IN_HAND[options.playerCount] },
				(_, index) => {
					const id = remainingTiles.pop()!;
					tilePositions[id] = { ...HANABI_DEFAULT_TILE_POSITIONS[index] };
					return id;
				},
			);
		}
		this.data = generateHanabiGameData({
			seed: options.seed,
			ruleSet: options.ruleSet,
			criticalGameOver: options.criticalGameOver,
			creatorId: turnOrder[0],
			allowDragging: false,
			showNotes: true,
			stage: HanabiStage.Playing,
			players: Object.fromEntries(turnOrder.map((id) => [id, generatePlayer({ id, name: id })])),
			turnOrder,
			currentPlayerId: turnOrder[0],
			tiles,
			remainingTiles,
			playerTiles,
			tilePositions,
		});
		this.initialState = structuredClone(this.data);
	}

	get state(): HanabiGameData {
		return structuredClone(this.data);
	}

	get turn(): number {
		return this.events.length;
	}

	get finished(): boolean {
		return this.data.stage === HanabiStage.Finished;
	}

	legalActions(playerId: string): BotLegalAction[] {
		return getBotLegalActions(this.data, playerId);
	}

	apply(playerId: string, actionId: string): BenchEvent {
		const legal = this.legalActions(playerId).find(({ id }) => id === actionId);
		if (!legal) throw new Error('Illegal action, wrong player, or finished game.');
		const { action } = legal;
		const data = this.data;
		const details: Omit<BenchEvent, 'postTurn'> = {
			turn: this.turn + 1,
			playerId,
			action,
		};
		if (action.type === 'clue') {
			const hand = data.playerTiles[action.to];
			details.touchedTileIds = hand.filter((id) =>
				doesHanabiTileMatchClue(data.tiles[id], data.ruleSet, action),
			);
			details.untouchedTileIds = hand.filter((id) => !details.touchedTileIds!.includes(id));
			for (const id of details.touchedTileIds) {
				data.tileNotes = {
					...data.tileNotes,
					[id]: addToTileNotes(data.tileNotes[id], action.color, action.number),
				};
			}
			data.clues -= 1;
		} else {
			const tile = data.tiles[action.tileId];
			details.tile = { ...tile };
			data.playerTiles = {
				...data.playerTiles,
				[playerId]: data.playerTiles[playerId].filter((id) => id !== tile.id),
			};
			if (data.remainingTiles.length) {
				const drawnId = data.remainingTiles[data.remainingTiles.length - 1];
				data.remainingTiles = data.remainingTiles.slice(0, -1);
				data.playerTiles[playerId].push(drawnId);
				details.drawnCard = this.card(drawnId, true);
			}
			const positions = { ...data.tilePositions };
			delete positions[tile.id];
			for (const [index, id] of data.playerTiles[playerId].entries()) {
				positions[id] = { ...HANABI_DEFAULT_TILE_POSITIONS[index] };
			}
			data.tilePositions = positions;
			if (action.type === 'play') {
				const sequence = getHanabiFireworkSequence(tile.color);
				const built = data.playedTiles.filter((id) => data.tiles[id].color === tile.color).length;
				details.valid = sequence[built] === tile.number;
				if (details.valid) {
					data.playedTiles = [...data.playedTiles, tile.id];
					if (isHanabiFireworkCompletion(tile))
						data.clues = Math.min(HANABI_MAX_CLUES, data.clues + 1);
				} else {
					data.discardedTiles = [...data.discardedTiles, tile.id];
					data.lives -= 1;
					if (data.lives === 0) this.finish(HanabiFinishedReason.OutOfLives);
				}
			} else {
				data.discardedTiles = [...data.discardedTiles, tile.id];
				data.clues = Math.min(HANABI_MAX_CLUES, data.clues + 1);
			}
			if (data.criticalGameOver && details.valid !== true && this.isFatal(tile)) {
				this.finish(HanabiFinishedReason.DiscardedFatalTile);
			}
		}
		// Match the website's final-turn accounting, including a last draw on a terminal play.
		if (
			data.remainingTurns === null &&
			action.type !== 'clue' &&
			data.remainingTiles.length === 0
		) {
			data.remainingTurns = data.turnOrder.length;
		} else if (data.remainingTurns !== null) {
			data.remainingTurns -= 1;
			if (data.remainingTurns === 0) this.finish(HanabiFinishedReason.OutOfTurns);
		}
		if (data.playedTiles.length === getHanabiCompletionTileCount(data.ruleSet)) {
			this.finish(HanabiFinishedReason.Won);
		}
		const currentIndex = data.turnOrder.indexOf(playerId);
		data.currentPlayerId = data.turnOrder[(currentIndex + 1) % data.turnOrder.length];
		const event = { ...details, postTurn: this.publicState() };
		this.events.push(event);
		return structuredClone(event);
	}

	/** The only player-facing boundary. It excludes the seed, undealt cards, and all derived hints. */
	observe(playerId: string, afterTurn = 0): BenchObservation {
		if (!Object.hasOwn(this.data.players, playerId)) throw new Error('Unknown player.');
		if (!Number.isInteger(afterTurn) || afterTurn < 0 || afterTurn > this.turn) {
			throw new Error('Invalid event cursor.');
		}
		return {
			version: 1,
			playerId,
			turn: this.turn,
			ruleSet: this.data.ruleSet,
			criticalGameOver: this.data.criticalGameOver,
			turnOrder: [...this.data.turnOrder],
			...this.publicState(),
			hands: this.data.turnOrder.map((ownerId) => ({
				playerId: ownerId,
				cards: this.data.playerTiles[ownerId].map((id) => ({
					...this.card(id, ownerId !== playerId),
					clues: {
						colors: [...(this.data.tileNotes[id]?.colors ?? [])],
						numbers: [...(this.data.tileNotes[id]?.numbers ?? [])],
					},
				})),
			})),
			played: this.data.playedTiles.map((id) => ({ ...this.data.tiles[id] })),
			discarded: this.data.discardedTiles.map((id) => ({ ...this.data.tiles[id] })),
			events: this.events.slice(afterTurn).map((event) => {
				const visible = structuredClone(event);
				if (visible.drawnCard && visible.playerId === playerId) visible.drawnCard.face = null;
				return visible;
			}),
			legalActions: this.legalActions(playerId),
		};
	}

	transcript(): BenchTranscript {
		return structuredClone({
			version: 1,
			options: this.options,
			initialState: this.initialState,
			events: this.events,
			finalState: this.data,
		});
	}

	rules(): string {
		const { ruleSet, playerCount, criticalGameOver } = this.options;
		const suits = getHanabiRuleSetColors(ruleSet);
		return [
			'Hanabi rules (fixed; conventions cannot change these rules).',
			`This is a cooperative ${playerCount}-player game using the ${ruleSet} variant. Seating and turn order are player-1 through player-${playerCount}, starting with player-1. Each player starts with ${HANABI_TILES_IN_HAND[playerCount]} cards. The deck is shuffled before dealing. Start with ${HANABI_MAX_CLUES} clue tokens and ${HANABI_MAX_LIVES} lives.`,
			"You see every other player's card faces but never your own or the undealt deck. Hands are ordered oldest to newest; replacement cards are appended at the right with the highest card-ID ordinal. Remaining cards keep their relative order after a play or discard. Card IDs identify physical cards and convey no suit or rank information. Players cannot rearrange cards or communicate during play except through game actions. Private explanations and reflections are not messages to teammates.",
			'On your turn choose exactly one supplied legal action ID: play one of your cards, discard one of your cards, or give one clue to another player. Play and discard choices are listed even when they would be unsuccessful or costly; their availability provides no information about the hidden card.',
			"Playing reveals the chosen card. It succeeds only if it is the next required rank in its suit's sequence. A duplicate or out-of-sequence play fails, discards the card, and costs one life. Completing a suit restores one clue token, up to eight. Discarding reveals and removes the card and restores one clue token; discarding is forbidden when all eight tokens are available. After a play or discard, draw a replacement if the deck has cards, even on an action that ends the game. The actor does not see that replacement; teammates do.",
			`A clue costs one token and is unavailable at zero tokens. It must identify either one rank (1–5) or one allowed color (${getHanabiClueColors(ruleSet).join(', ')}) in another player's hand, touching at least one card. It identifies every matching card, not a chosen subset. Untouched cards in that hand do not match the clue. New cards do not inherit clues given before they arrived. These are literal clue facts, not agreements about intended actions.`,
			...suits.map(
				(color) =>
					`${color}: build ${getHanabiFireworkSequence(color).join(' → ')}; copies by rank: ${([1, 2, 3, 4, 5] as const).map((number) => `${number}:${getHanabiTileCopyCount(color, number)}`).join(', ')}.`,
			),
			...(suits.includes('rainbow')
				? [
						'Rainbow cards match every allowed color clue. Rainbow itself is not an allowed color clue. Rank clues work normally.',
					]
				: []),
			...(suits.includes('black')
				? [
						'Black Powder cards match rank clues only, never color clues, and build from 5 down to 1. Completing Black on 1 restores a clue. Score is max(0, ordinary/rainbow cards successfully played − (5 − Black cards successfully played)); Black does not add to the colored-score maximum.',
					]
				: ['Score is the number of successfully played cards.']),
			`Maximum score is ${getHanabiMaxScore(ruleSet)}. Completing all ${getHanabiCompletionTileCount(ruleSet)} required plays ends the game. Losing all lives also ends the game. When the last card is drawn, each player receives one final turn, including the player who drew it; remainingTurns is the countdown after the triggering action. After those turns the game ends. Score is counted from the built fireworks even when the game ends through lost lives.`,
			criticalGameOver
				? 'Critical game over is enabled: discarding or misplaying the final available copy of an unbuilt suit/rank immediately ends the game, even with lives remaining.'
				: 'Critical game over is disabled: discarding or misplaying the final available copy of an unbuilt suit/rank does not by itself end the game.',
			'An observation supplies visible hands, played and discarded cards, resources, turn state, literal positive clue marks, and intervening events. Clue events list touched and untouched card IDs. After your action, a reflection opportunity supplies its outcome but permits no additional gameplay action. Your own remaining cards stay concealed even after the game ends. Rules contain no conventions or strategic recommendations.',
		].join('\n\n');
	}

	private card(id: string, visible: boolean): BenchCard {
		const { color, number } = this.data.tiles[id];
		return { id, face: visible ? { color, number } : null };
	}

	private publicState(): BenchPublicState {
		const data = this.data;
		return {
			currentPlayerId: data.currentPlayerId,
			clues: data.clues,
			lives: data.lives,
			deckCount: data.remainingTiles.length,
			remainingTurns: data.remainingTurns,
			score: getHanabiScore(data),
			maxScore: getHanabiMaxScore(data.ruleSet),
			stage: data.stage,
			finishedReason: data.finishedReason,
		};
	}

	private isFatal(tile: HanabiTile): boolean {
		const matches = (id: string) =>
			this.data.tiles[id].color === tile.color && this.data.tiles[id].number === tile.number;
		return (
			!this.data.playedTiles.some(matches) &&
			!this.data.remainingTiles.some(matches) &&
			!Object.values(this.data.playerTiles).some((hand) => hand.some(matches))
		);
	}

	private finish(reason: HanabiFinishedReason): void {
		this.data.stage = HanabiStage.Finished;
		this.data.finishedReason = reason;
	}
}
