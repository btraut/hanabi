import { generateHanabiGameData, HanabiGameActionType, HanabiStage } from '@hanabi/shared';
import { describe, expect, it } from 'vitest';
import { appendBotArrangement, appendBotHistory, createBotHistory } from './BotHistory.js';
import {
	botNotepadsMatchHistory,
	getBotNotepadCheckpoint,
	isBotNotepads,
	MAX_BOT_NOTE_LENGTH,
	type BotNotepads,
} from './BotNotepad.js';

function fixture() {
	const game = generateHanabiGameData({
		stage: HanabiStage.Playing,
		turnOrder: ['bot:one', 'human', 'bot:two'],
		currentPlayerId: 'bot:one',
		tiles: {
			a: { id: 'a', color: 'red', number: 1 },
			b: { id: 'b', color: 'blue', number: 2 },
			c: { id: 'c', color: 'green', number: 3 },
		},
		playerTiles: { 'bot:one': ['a'], 'bot:two': ['b'], human: ['c'] },
		tilePositions: {
			a: { x: 10, y: 10, z: 0 },
			b: { x: 10, y: 10, z: 0 },
			c: { x: 10, y: 10, z: 0 },
		},
	});
	const initial = createBotHistory(game, 2);
	const initialPoint = getBotNotepadCheckpoint(initial);
	const before = structuredClone(game);
	game.clues = 7;
	game.currentPlayerId = 'human';
	let history = appendBotHistory(
		initial,
		{
			id: 'action-1',
			type: HanabiGameActionType.GiveNumberClue,
			playerId: 'bot:one',
			recipientId: 'bot:two',
			number: 2,
			tiles: [game.tiles.b],
		},
		game,
		before,
	);
	const cluePoint = getBotNotepadCheckpoint(history);
	const oldPositions = game.tilePositions;
	game.tilePositions = { ...oldPositions, b: { x: 120, y: 80, z: 0 } };
	history = appendBotArrangement(history, 'bot:two', oldPositions, game, 'event-1');
	const arrangementPoint = getBotNotepadCheckpoint(history);
	const notepads: BotNotepads = {
		'bot:one': {
			version: 1,
			entries: [
				{
					decisionId: 'decision-1',
					opportunity: 'turn',
					observedAt: initialPoint,
					recordedAt: cluePoint,
					sourceClueEventIds: [],
					explanation: 'I gave the 2 clue to preserve this card.',
					notes: null,
				},
			],
		},
		'bot:two': {
			version: 1,
			entries: [
				{
					decisionId: 'decision-2',
					opportunity: 'clue',
					observedAt: cluePoint,
					recordedAt: arrangementPoint,
					sourceClueEventIds: ['event-1'],
					explanation: 'I set the clued card aside.',
					notes: 'This may be a play clue, but its suit is not confirmed.',
				},
			],
		},
	};
	return { history, notepads, initialPoint, cluePoint, arrangementPoint };
}

describe('BotNotepad', () => {
	it('captures initial and event checkpoints without retaining mutable history references', () => {
		const { history, initialPoint, cluePoint, arrangementPoint } = fixture();
		expect(initialPoint).toEqual({ eventId: 'initial', sequence: 0, turnIndex: 0 });
		expect(cluePoint).toEqual({ eventId: 'event-1', sequence: 1, turnIndex: 1 });
		expect(arrangementPoint).toEqual({ eventId: 'event-2', sequence: 2, turnIndex: 1 });
		if (history.version !== 2) throw new Error('Expected v2');
		history.events[1].sequence = 99;
		expect(arrangementPoint.sequence).toBe(2);
	});

	it('preserves explanations and arbitrary multiline notes with valid per-seat provenance', () => {
		const { history, notepads } = fixture();
		notepads['bot:two'].entries[0].notes =
			'Hypothesis: red 2\n\nRecheck after the next clue.\n{"quoted":"text"}';
		const restored: unknown = JSON.parse(JSON.stringify(notepads));
		expect(isBotNotepads(restored)).toBe(true);
		expect(botNotepadsMatchHistory(notepads, history, ['bot:one', 'bot:two'])).toBe(true);
		expect(restored).toEqual(notepads);
		expect(isBotNotepads({})).toBe(true);
		expect(isBotNotepads(undefined)).toBe(false);
	});

	it('validates text and nested checkpoint structure without truncating values', () => {
		const { notepads } = fixture();
		const item = notepads['bot:two'].entries[0];
		item.notes = 'x'.repeat(MAX_BOT_NOTE_LENGTH);
		expect(isBotNotepads(notepads)).toBe(true);
		item.notes += 'x';
		expect(isBotNotepads(notepads)).toBe(false);
		item.notes = '  \n';
		expect(isBotNotepads(notepads)).toBe(false);
		item.notes = null;
		item.explanation = '';
		expect(isBotNotepads(notepads)).toBe(false);
		item.explanation = 'Valid explanation';
		item.recordedAt.sequence = Infinity;
		expect(isBotNotepads(notepads)).toBe(false);
		expect(isBotNotepads({ 'bot:one': { version: 1, entries: [null] } })).toBe(false);
	});

	it('rejects foreign owners, duplicate decisions, false checkpoints and wrong clue sources', () => {
		for (const corrupt of [
			(notepads: BotNotepads) => {
				notepads.human = { version: 1, entries: [] };
			},
			(notepads: BotNotepads) => {
				notepads['bot:two'].entries[0].decisionId = 'decision-1';
			},
			(notepads: BotNotepads) => {
				notepads['bot:two'].entries[0].observedAt.turnIndex = 0;
			},
			(notepads: BotNotepads) => {
				notepads['bot:two'].entries[0].sourceClueEventIds = ['missing'];
			},
			(notepads: BotNotepads) => {
				notepads['bot:two'].entries[0].sourceClueEventIds = ['event-2'];
			},
			(notepads: BotNotepads) => {
				notepads['bot:two'].entries[0].sourceClueEventIds = [];
			},
			(notepads: BotNotepads) => {
				notepads['bot:one'].entries[0].sourceClueEventIds = ['event-1'];
			},
			(notepads: BotNotepads) => {
				notepads['bot:two'].entries[0].observedAt = {
					eventId: 'initial',
					sequence: 0,
					turnIndex: 0,
				};
			},
		]) {
			const { history, notepads } = fixture();
			corrupt(notepads);
			expect(botNotepadsMatchHistory(notepads, history, ['bot:one', 'bot:two'])).toBe(false);
		}
	});

	it('rejects backwards checkpoint or append order while allowing no-op decisions at the same event', () => {
		const { history, notepads, initialPoint, cluePoint, arrangementPoint } = fixture();
		const first = notepads['bot:two'].entries[0];
		first.recordedAt = initialPoint;
		expect(botNotepadsMatchHistory(notepads, history, ['bot:one', 'bot:two'])).toBe(false);
		first.recordedAt = arrangementPoint;
		const next = { ...first, decisionId: 'decision-3', observedAt: cluePoint };
		notepads['bot:two'].entries.push(next);
		expect(botNotepadsMatchHistory(notepads, history, ['bot:one', 'bot:two'])).toBe(false);
		next.observedAt = arrangementPoint;
		expect(botNotepadsMatchHistory(notepads, history, ['bot:one', 'bot:two'])).toBe(true);
	});

	it('retains an unrestricted number of accepted entries', () => {
		const { history, notepads, arrangementPoint } = fixture();
		const item = notepads['bot:two'].entries[0];
		notepads['bot:two'].entries = Array.from({ length: 2_000 }, (_, index) => ({
			...item,
			decisionId: `entry-${index}`,
			observedAt: arrangementPoint,
		}));
		expect(isBotNotepads(notepads)).toBe(true);
		expect(botNotepadsMatchHistory(notepads, history, ['bot:one', 'bot:two'])).toBe(true);
		expect(notepads['bot:two'].entries).toHaveLength(2_000);
	});

	it("rejects swapped seated-bot notebooks and decisions that include someone else's event", () => {
		const { history, notepads, arrangementPoint } = fixture();
		expect(
			botNotepadsMatchHistory({ 'bot:two': notepads['bot:one'] }, history, ['bot:one', 'bot:two']),
		).toBe(false);
		notepads['bot:one'].entries[0].recordedAt = arrangementPoint;
		expect(botNotepadsMatchHistory(notepads, history, ['bot:one', 'bot:two'])).toBe(false);
	});

	it('rejects serialized fields outside the private-notepad contract at every level', () => {
		for (const inject of [
			(notepads: BotNotepads) => Object.assign(notepads['bot:one'], { otherBotNotes: 'private' }),
			(notepads: BotNotepads) =>
				Object.assign(notepads['bot:one'].entries[0], { observation: 'private' }),
			(notepads: BotNotepads) =>
				Object.assign(notepads['bot:one'].entries[0].observedAt, { hiddenFaces: 'private' }),
		]) {
			const { notepads } = fixture();
			inject(notepads);
			expect(isBotNotepads(notepads)).toBe(false);
		}
	});
});

describe('result notepad provenance', () => {
	function resultFixture(stage = HanabiStage.Playing, discard = false) {
		const game = generateHanabiGameData({
			stage: HanabiStage.Playing,
			turnOrder: ['bot', 'human'],
			currentPlayerId: 'bot',
			tiles: {
				a: { id: 'a', color: 'red', number: 3 },
				b: { id: 'b', color: 'blue', number: 1 },
				c: { id: 'c', color: 'green', number: 2 },
			},
			playerTiles: { bot: ['a', 'b'], human: ['c'] },
		});
		const initial = createBotHistory(game, 2);
		const before = structuredClone(game);
		game.playerTiles = { ...game.playerTiles, bot: ['b'] };
		game.currentPlayerId = 'human';
		game.stage = stage;
		const history = appendBotHistory(
			initial,
			discard
				? {
						id: 'action-1',
						type: HanabiGameActionType.Discard,
						playerId: 'bot',
						tile: game.tiles.a,
					}
				: {
						id: 'action-1',
						type: HanabiGameActionType.Play,
						playerId: 'bot',
						tile: game.tiles.a,
						valid: false,
						remainingLives: game.lives,
					},
			game,
			before,
		);
		const point = getBotNotepadCheckpoint(history);
		const notepads: BotNotepads = {
			bot: {
				version: 1,
				entries: [
					{
						decisionId: 'result-1',
						opportunity: 'result',
						sourceActionEventId: 'event-1',
						sourceClueEventIds: [],
						observedAt: point,
						recordedAt: point,
						explanation: 'The revealed card changes my reserve plan.',
						notes: 'Protect card b.',
					},
				],
			},
		};
		return { game, history, notepads };
	}

	it.each([false, true])(
		'accepts result notes for own play or discard (%s), including the terminal action',
		(discard) => {
			for (const stage of [HanabiStage.Playing, HanabiStage.Finished]) {
				const { history, notepads } = resultFixture(stage, discard);
				expect(isBotNotepads(notepads)).toBe(true);
				expect(botNotepadsMatchHistory(notepads, history, ['bot'])).toBe(true);
			}
		},
	);

	it('permits an own arrangement after a result only while playing', () => {
		for (const stage of [HanabiStage.Playing, HanabiStage.Finished]) {
			const { game, history, notepads } = resultFixture(stage);
			const positions = game.tilePositions;
			game.tilePositions = { ...positions, b: { x: 50, y: 250, z: 0 } };
			const arranged = appendBotArrangement(history, 'bot', positions, game);
			notepads.bot.entries[0].recordedAt = getBotNotepadCheckpoint(arranged);
			expect(botNotepadsMatchHistory(notepads, arranged, ['bot'])).toBe(
				stage === HanabiStage.Playing,
			);
		}
	});

	it('rejects missing, foreign, non-action, and future result sources', () => {
		for (const change of [
			(pads: BotNotepads) => {
				delete pads.bot.entries[0].sourceActionEventId;
			},
			(pads: BotNotepads) => {
				pads.bot.entries[0].sourceActionEventId = 'missing';
			},
			(pads: BotNotepads) => {
				pads.bot.entries[0].observedAt = { eventId: 'initial', sequence: 0, turnIndex: 0 };
			},
			(pads: BotNotepads) => {
				pads.bot.entries[0].sourceClueEventIds = ['event-1'];
			},
		]) {
			const { history, notepads } = resultFixture();
			change(notepads);
			expect(botNotepadsMatchHistory(notepads, history, ['bot'])).toBe(false);
		}
		const { history, notepads } = resultFixture();
		expect(botNotepadsMatchHistory({ human: notepads.bot }, history, ['human'])).toBe(false);
		const clue = fixture();
		const entry = clue.notepads['bot:one'].entries[0];
		entry.opportunity = 'result';
		entry.sourceActionEventId = 'event-1';
		entry.observedAt = entry.recordedAt;
		expect(botNotepadsMatchHistory(clue.notepads, clue.history, ['bot:one', 'bot:two'])).toBe(
			false,
		);
	});

	it('rejects repeated reflection on the same action even with a new decision ID', () => {
		const { history, notepads } = resultFixture();
		notepads.bot.entries.push({ ...notepads.bot.entries[0], decisionId: 'result-duplicate' });
		expect(botNotepadsMatchHistory(notepads, history, ['bot'])).toBe(false);
	});

	it.each(['human', 'bot'])(
		'allows a delayed result after a later %s action only for another seat',
		(actorId) => {
			const { game, history, notepads } = resultFixture();
			const before = structuredClone(game);
			const recipientId = actorId === 'human' ? 'bot' : 'human';
			const tile = game.tiles[actorId === 'human' ? 'b' : 'c'];
			game.currentPlayerId = recipientId;
			const later = appendBotHistory(
				history,
				{
					id: 'later-clue',
					type: HanabiGameActionType.GiveNumberClue,
					playerId: actorId,
					recipientId,
					number: tile.number,
					tiles: [tile],
				},
				game,
				before,
			);
			const checkpoint = getBotNotepadCheckpoint(later);
			notepads.bot.entries[0].observedAt = checkpoint;
			notepads.bot.entries[0].recordedAt = checkpoint;
			expect(botNotepadsMatchHistory(notepads, later, ['bot'])).toBe(actorId === 'human');
		},
	);

	it('rejects a further gameplay action committed by a result response', () => {
		const { game, history, notepads } = resultFixture();
		const before = structuredClone(game);
		game.playerTiles = { ...game.playerTiles, bot: [] };
		const next = appendBotHistory(
			history,
			{
				id: 'action-2',
				type: HanabiGameActionType.Play,
				playerId: 'bot',
				tile: game.tiles.b,
				valid: true,
				remainingLives: game.lives,
			},
			game,
			before,
		);
		notepads.bot.entries[0].recordedAt = getBotNotepadCheckpoint(next);
		expect(botNotepadsMatchHistory(notepads, next, ['bot'])).toBe(false);
	});

	it('allows another player to act and arrange while a result is in flight', () => {
		const { game, history, notepads } = resultFixture();
		const before = structuredClone(game);
		game.currentPlayerId = 'bot';
		let next = appendBotHistory(
			history,
			{
				id: 'human-clue',
				type: HanabiGameActionType.GiveNumberClue,
				playerId: 'human',
				recipientId: 'bot',
				number: 1,
				tiles: [game.tiles.b],
			},
			game,
			before,
		);
		let positions = game.tilePositions;
		game.tilePositions = { ...positions, c: { x: 80, y: 250, z: 0 } };
		next = appendBotArrangement(next, 'human', positions, game);
		notepads.bot.entries[0].recordedAt = getBotNotepadCheckpoint(next);
		expect(botNotepadsMatchHistory(notepads, next, ['bot'])).toBe(true);

		positions = game.tilePositions;
		game.tilePositions = { ...positions, b: { x: 50, y: 250, z: 0 } };
		next = appendBotArrangement(next, 'bot', positions, game);
		notepads.bot.entries[0].recordedAt = getBotNotepadCheckpoint(next);
		expect(botNotepadsMatchHistory(notepads, next, ['bot'])).toBe(true);

		positions = game.tilePositions;
		game.tilePositions = { ...positions, b: { x: 60, y: 250, z: 0 } };
		next = appendBotArrangement(next, 'bot', positions, game);
		notepads.bot.entries[0].recordedAt = getBotNotepadCheckpoint(next);
		expect(botNotepadsMatchHistory(notepads, next, ['bot'])).toBe(false);
	});

	it('allows notes when another player ends the game during a result request', () => {
		const { game, history, notepads } = resultFixture();
		const before = structuredClone(game);
		game.playerTiles = { ...game.playerTiles, human: [] };
		game.stage = HanabiStage.Finished;
		const next = appendBotHistory(
			history,
			{
				id: 'terminal-play',
				type: HanabiGameActionType.Play,
				playerId: 'human',
				tile: game.tiles.c,
				valid: false,
				remainingLives: 0,
			},
			game,
			before,
		);
		notepads.bot.entries[0].recordedAt = getBotNotepadCheckpoint(next);
		expect(botNotepadsMatchHistory(notepads, next, ['bot'])).toBe(true);
		const positions = game.tilePositions;
		game.tilePositions = { ...positions, b: { x: 50, y: 250, z: 0 } };
		const arranged = appendBotArrangement(next, 'bot', positions, game);
		notepads.bot.entries[0].recordedAt = getBotNotepadCheckpoint(arranged);
		expect(botNotepadsMatchHistory(notepads, arranged, ['bot'])).toBe(false);
	});
});
