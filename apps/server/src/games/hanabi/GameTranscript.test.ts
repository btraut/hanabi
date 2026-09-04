import {
	generateHanabiGameData,
	generatePlayer,
	HanabiGameActionType,
	HanabiStage,
	HanabiTile,
} from '@hanabi/shared';
import { describe, expect, it } from 'vitest';
import {
	appendGameTranscriptMove,
	createGameTranscript,
	createPartialGameTranscript,
	resetGameTranscript,
} from './GameTranscript.js';

const identity = { gameId: 'game-1', gameCode: 'ABCDEF' };

describe('GameTranscript', () => {
	it('captures the deal and remaining stack in first-consumed-first order', () => {
		const tiles: Record<string, HanabiTile> = {
			first: { id: 'first', color: 'red', number: 1 },
			second: { id: 'second', color: 'blue', number: 2 },
			third: { id: 'third', color: 'green', number: 3 },
			fourth: { id: 'fourth', color: 'yellow', number: 4 },
		};
		const gameData = generateHanabiGameData({
			seed: 'round-1',
			stage: HanabiStage.Playing,
			players: {
				alice: generatePlayer({ id: 'alice', name: 'Alice' }),
				bob: generatePlayer({ id: 'bob', name: 'Bob' }),
			},
			turnOrder: ['bob', 'alice'],
			currentPlayerId: 'bob',
			tiles,
			playerTiles: { alice: ['first'], bob: ['second'] },
			remainingTiles: ['fourth', 'third'],
		});

		const transcript = createGameTranscript(identity, gameData, '2026-09-02T04:00:00.000Z');

		expect(transcript.dealOrder).toEqual([
			{ playerId: 'alice', tileIds: ['first'] },
			{ playerId: 'bob', tileIds: ['second'] },
		]);
		expect(transcript.turnOrder).toEqual(['bob', 'alice']);
		expect(transcript.deck?.map(({ id }) => id)).toEqual(['first', 'second', 'third', 'fourth']);
		expect(new Set(transcript.deck?.map(({ id }) => id)).size).toBe(Object.keys(tiles).length);
		expect(transcript.integrity).toEqual({ status: 'complete' });
	});

	it('appends accepted actions as sequential post-turn snapshots', () => {
		const tile: HanabiTile = { id: 'red-1', color: 'red', number: 1 };
		const gameData = generateHanabiGameData({
			seed: 'round-1',
			stage: HanabiStage.Playing,
			players: {
				alice: generatePlayer({ id: 'alice', name: 'Alice' }),
				bob: generatePlayer({ id: 'bob', name: 'Bob' }),
			},
			turnOrder: ['alice', 'bob'],
			currentPlayerId: 'bob',
			clues: 7,
			tiles: { [tile.id]: tile },
			playedTiles: [tile.id],
			playerTiles: { alice: [], bob: [] },
		});
		const started = createGameTranscript(identity, gameData, '2026-09-02T04:00:00.000Z');

		const transcript = appendGameTranscriptMove(
			started,
			{
				id: 'action-1',
				createdAt: '2026-09-02T04:00:01.000Z',
				type: HanabiGameActionType.Play,
				playerId: 'alice',
				tile,
				valid: true,
				remainingLives: 3,
			},
			gameData,
		);

		expect(transcript.revision).toBe(2);
		expect(transcript.moves).toEqual([
			expect.objectContaining({
				type: 'play',
				actionId: 'action-1',
				index: 0,
				actorId: 'alice',
				tileId: tile.id,
				valid: true,
				postTurn: {
					nextPlayerId: 'bob',
					clues: 7,
					lives: 3,
					remainingTurns: null,
					score: 1,
					status: 'in_progress',
				},
			}),
		]);
	});

	it('marks legacy active games partial and finalizes resets without inventing a move', () => {
		const gameData = generateHanabiGameData({
			seed: 'legacy-round',
			stage: HanabiStage.Playing,
			players: { alice: generatePlayer({ id: 'alice', name: 'Alice' }) },
			turnOrder: ['alice'],
			currentPlayerId: 'alice',
			playerTiles: { alice: [] },
		});
		const partial = createPartialGameTranscript(identity, gameData, '2026-09-02T04:00:00.000Z');
		const reset = resetGameTranscript(partial, '2026-09-02T04:01:00.000Z');

		expect(partial).toMatchObject({
			dealOrder: null,
			deck: null,
			integrity: { status: 'partial' },
		});
		expect(reset).toMatchObject({
			revision: 2,
			moves: [],
			lifecycle: {
				status: 'reset',
				endedAt: '2026-09-02T04:01:00.000Z',
			},
		});
	});
});
