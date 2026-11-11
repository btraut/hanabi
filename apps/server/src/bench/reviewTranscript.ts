import { isDeepStrictEqual } from 'node:util';
import {
	HanabiGameActionType,
	type GameTranscriptV1,
	type HanabiGameAction,
	type HanabiGameData,
} from '@hanabi/shared';
import { appendGameTranscriptMove, createGameTranscript } from '../games/hanabi/GameTranscript.js';
import { BenchGame, type BenchEvent, type BenchTranscript } from './engine.js';

// Bench v1 records acceptance order, not wall-clock times. These stable timestamps
// satisfy the shared recording format and must not be presented as actual game timing.
function acceptanceTimestamp(turn: number): string {
	return new Date(turn).toISOString();
}

function actionFor(event: BenchEvent, data: HanabiGameData, id: string): HanabiGameAction {
	const base = {
		id: `${id}:turn:${event.turn}`,
		createdAt: acceptanceTimestamp(event.turn),
		playerId: event.playerId,
	};
	const { action } = event;
	if (action.type === 'clue') {
		return {
			...base,
			type:
				action.color === undefined
					? HanabiGameActionType.GiveNumberClue
					: HanabiGameActionType.GiveColorClue,
			recipientId: action.to,
			...(action.color === undefined ? { number: action.number } : { color: action.color }),
			tiles: event.touchedTileIds!.map((tileId) => ({ ...data.tiles[tileId] })),
		};
	}
	const tile = { ...data.tiles[action.tileId] };
	return action.type === 'play'
		? {
				...base,
				type: HanabiGameActionType.Play,
				tile,
				valid: event.valid!,
				remainingLives: data.lives,
			}
		: { ...base, type: HanabiGameActionType.Discard, tile };
}

/** Validate a privileged Bench recording before adapting it for the shared review board. */
export function toReviewTranscript(
	transcript: BenchTranscript,
	id: string,
	playerNames: Record<string, string> = {},
): GameTranscriptV1 {
	if (!transcript || transcript.version !== 1 || !Array.isArray(transcript.events)) {
		throw new Error('Unsupported Bench transcript.');
	}
	if (typeof id !== 'string' || !id.trim())
		throw new Error('A Bench review needs a game identifier.');
	const game = new BenchGame(transcript.options);
	if (!isDeepStrictEqual(game.state, transcript.initialState)) {
		throw new Error('Bench initial state does not match its deterministic deal.');
	}
	const initial = game.state;
	initial.players = Object.fromEntries(
		Object.entries(initial.players).map(([playerId, player]) => [
			playerId,
			{
				...player,
				name:
					typeof playerNames[playerId] === 'string' && playerNames[playerId].trim()
						? playerNames[playerId]
						: player.name,
			},
		]),
	);
	let review = createGameTranscript({ gameId: id, gameCode: id }, initial, acceptanceTimestamp(0));
	// Matched benchmark deals share seeds across configurations; review identity must not.
	review.roundId = id;
	for (const event of transcript.events) {
		if (!event || event.turn !== game.turn + 1)
			throw new Error('Bench events are not in acceptance order.');
		const legal = game
			.legalActions(event.playerId)
			.find(({ action }) => isDeepStrictEqual(action, event.action));
		if (!legal) throw new Error(`Invalid Bench action at turn ${event.turn}.`);
		const actual = game.apply(event.playerId, legal.id);
		if (!isDeepStrictEqual(actual, event)) {
			throw new Error(`Bench event at turn ${event.turn} does not match deterministic replay.`);
		}
		const data = game.state;
		review = appendGameTranscriptMove(review, actionFor(event, data, id), data);
	}
	if (!isDeepStrictEqual(game.transcript(), transcript)) {
		throw new Error('Bench transcript does not match deterministic replay.');
	}
	return review;
}
