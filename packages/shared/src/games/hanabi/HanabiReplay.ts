import { GAME_TRANSCRIPT_VERSION, type GameTranscriptV1 } from './GameTranscript.js';
import {
	addToTileNotes,
	generateHanabiGameData,
	HANABI_DEFAULT_TILE_POSITIONS,
	HanabiGameActionType,
	HanabiStage,
	type HanabiGameAction,
	type HanabiGameData,
	type HanabiTile,
	type Position,
} from './HanabiGameData.js';

/** Review is available only when a complete round has ended. */
export function isReplayableTranscript(transcript: GameTranscriptV1 | null | undefined): boolean {
	return Boolean(
		transcript &&
		transcript.version === GAME_TRANSCRIPT_VERSION &&
		transcript.lifecycle.status === 'finished' &&
		transcript.integrity.status === 'complete' &&
		transcript.deck?.length &&
		transcript.dealOrder?.length &&
		transcript.turnOrder.length &&
		transcript.result &&
		transcript.moves.at(-1)?.postTurn.status === 'finished',
	);
}

/**
 * Rebuild the authoritative board after `cursor` accepted moves (zero is the deal).
 * Recorded post-turn values are authoritative; replay does not re-adjudicate rules.
 * Hand positions use deal/draw order because transcripts do not record dragging.
 */
export function replayHanabiTranscript(
	transcript: GameTranscriptV1,
	cursor: number,
): HanabiGameData {
	if (!isReplayableTranscript(transcript)) {
		throw new Error('Only complete, finished game transcripts can be reviewed.');
	}
	if (!Number.isInteger(cursor) || cursor < 0 || cursor > transcript.moves.length) {
		throw new Error('Review position must be an integer within the recorded moves.');
	}

	const deck = transcript.deck!;
	const deal = transcript.dealOrder!;
	const dealtIds = new Set(deal.flatMap(({ tileIds }) => tileIds));
	const tiles = Object.fromEntries(deck.map((tile) => [tile.id, { ...tile }]));
	if (
		Object.keys(tiles).length !== deck.length ||
		dealtIds.size !== deal.reduce((sum, hand) => sum + hand.tileIds.length, 0) ||
		[...dealtIds].some((id) => !tiles[id]) ||
		transcript.turnOrder.some((id) => !deal.some((hand) => hand.playerId === id))
	) {
		throw new Error('The recorded deck or initial deal is incomplete.');
	}

	const data = generateHanabiGameData({
		seed: transcript.roundId,
		creatorId: transcript.players[0]?.id ?? '',
		...transcript.rules,
		stage: HanabiStage.Playing,
		players: Object.fromEntries(
			transcript.players.map((player) => [player.id, { ...player, connected: false }]),
		),
		turnOrder: [...transcript.turnOrder],
		currentPlayerId: transcript.turnOrder[0],
		tiles,
		playerTiles: Object.fromEntries(deal.map(({ playerId, tileIds }) => [playerId, [...tileIds]])),
		// Runtime draws from the end; transcripts store undealt cards in draw order.
		remainingTiles: deck
			.filter(({ id }) => !dealtIds.has(id))
			.map(({ id }) => id)
			.reverse(),
	});
	const actions: HanabiGameAction[] = [];

	for (const move of transcript.moves.slice(0, cursor)) {
		const base = { id: move.actionId, createdAt: move.createdAt, playerId: move.actorId };
		if (move.type === 'clue') {
			const hand = data.playerTiles[move.recipientId];
			if (!hand || move.selectedTileIds.some((id) => !hand.includes(id))) {
				throw new Error('A recorded clue refers to a tile outside the recipient hand.');
			}
			const color = move.clue.type === 'color' ? move.clue.value : undefined;
			const number = move.clue.type === 'number' ? move.clue.value : undefined;
			actions.push({
				...base,
				type:
					color === undefined
						? HanabiGameActionType.GiveNumberClue
						: HanabiGameActionType.GiveColorClue,
				recipientId: move.recipientId,
				color,
				number,
				tiles: move.selectedTileIds.map((id) => ({ ...tiles[id] })),
			});
			for (const tileId of move.selectedTileIds) {
				data.tileNotes = {
					...data.tileNotes,
					[tileId]: addToTileNotes(data.tileNotes[tileId], color, number),
				};
			}
		} else {
			const hand = data.playerTiles[move.actorId];
			if (!hand?.includes(move.tileId)) {
				throw new Error('A recorded move refers to a tile outside the actor hand.');
			}
			const nextHand = hand.filter((id) => id !== move.tileId);
			const drawnId = data.remainingTiles.at(-1);
			// Accepted plays/discards draw even when that action ends the game.
			if (drawnId !== undefined) {
				nextHand.push(drawnId);
				data.remainingTiles = data.remainingTiles.slice(0, -1);
			}
			data.playerTiles = { ...data.playerTiles, [move.actorId]: nextHand };
			const tile = { ...tiles[move.tileId] };
			if (move.type === 'play') {
				actions.push({
					...base,
					type: HanabiGameActionType.Play,
					tile,
					valid: move.valid,
					remainingLives: move.postTurn.lives,
				});
				if (move.valid) {
					data.playedTiles = [...data.playedTiles, tile.id];
				} else {
					data.discardedTiles = [...data.discardedTiles, tile.id];
				}
			} else {
				actions.push({ ...base, type: HanabiGameActionType.Discard, tile });
				data.discardedTiles = [...data.discardedTiles, tile.id];
			}
		}
		data.currentPlayerId = move.postTurn.nextPlayerId;
		data.clues = move.postTurn.clues;
		data.lives = move.postTurn.lives;
		data.remainingTurns = move.postTurn.remainingTurns;
		data.stage = move.postTurn.status === 'finished' ? HanabiStage.Finished : HanabiStage.Playing;
		data.finishedReason =
			move.postTurn.status === 'finished'
				? (move.postTurn.result ?? transcript.result)!.finishedReason
				: null;
	}

	const positions: Record<string, Position> = {};
	for (const hand of Object.values(data.playerTiles)) {
		for (const [index, tileId] of hand.entries()) {
			positions[tileId] = { ...HANABI_DEFAULT_TILE_POSITIONS[index] };
		}
	}
	data.tilePositions = positions;
	data.actions = actions;
	return data;
}

function concealedTile(id: string): HanabiTile {
	return { id, color: 'white', number: 1, concealed: true };
}

/** Project a moment without revealing the selected player's hand or future deck. */
export function projectHanabiReplay(
	gameData: HanabiGameData,
	perspectiveId: string,
	revealAllHands: boolean,
): HanabiGameData {
	if (!Object.hasOwn(gameData.players, perspectiveId)) {
		throw new Error('Choose a recorded player to review their perspective.');
	}
	const projected = structuredClone(gameData);
	const concealedIds = new Set([
		...gameData.remainingTiles,
		...(revealAllHands ? [] : gameData.playerTiles[perspectiveId]),
	]);
	projected.seed = '';
	projected.tiles = Object.fromEntries(
		Object.entries(projected.tiles).map(([id, tile]) => [
			id,
			concealedIds.has(id) ? concealedTile(id) : tile,
		]),
	);
	projected.actions = projected.actions.map((action) => {
		if (
			action.type !== HanabiGameActionType.GiveColorClue &&
			action.type !== HanabiGameActionType.GiveNumberClue
		) {
			return action;
		}
		return {
			...action,
			tiles: action.tiles.map((tile) =>
				concealedIds.has(tile.id) ? concealedTile(tile.id) : tile,
			),
		};
	});
	return projected;
}
