import {
	generateHanabiGameData,
	generatePlayer,
	HanabiStage,
	type HanabiGameData,
} from '@hanabi/shared';
import { describe, expect, it } from 'vitest';
import { getBotLegalActions } from './BotLegalActions.js';

function state(overrides: Partial<HanabiGameData> = {}): HanabiGameData {
	return generateHanabiGameData({
		stage: HanabiStage.Playing,
		players: { bot: generatePlayer({ id: 'bot' }), human: generatePlayer({ id: 'human' }) },
		turnOrder: ['bot', 'human'],
		currentPlayerId: 'bot',
		clues: 7,
		tiles: {
			own: { id: 'own', color: 'red', number: 5 },
			other: { id: 'other', color: 'blue', number: 2 },
		},
		playerTiles: { bot: ['own'], human: ['other'] },
		...overrides,
	});
}

describe('getBotLegalActions', () => {
	it('includes a failed play and fatal discard without examining the hidden face', () => {
		expect(getBotLegalActions(state(), 'bot')).toEqual([
			{ id: 'action-0', action: { type: 'play', tileId: 'own' } },
			{ id: 'action-1', action: { type: 'discard', tileId: 'own' } },
			{ id: 'action-2', action: { type: 'clue', to: 'human', color: 'blue' } },
			{ id: 'action-3', action: { type: 'clue', to: 'human', number: 2 } },
		]);
	});

	it('does not inspect own faces even with one life and one final turn remaining', () => {
		const original = state({ lives: 1, remainingTurns: 1 });
		const changed = structuredClone(original);
		changed.tiles = { other: changed.tiles.other, own: { id: 'own', color: 'white', number: 1 } };
		changed.seed = 'a different secret';
		expect(getBotLegalActions(changed, 'bot')).toEqual(getBotLegalActions(original, 'bot'));
		expect(getBotLegalActions({ ...changed, criticalGameOver: false }, 'bot')).toEqual(
			getBotLegalActions(original, 'bot'),
		);
	});

	it('permits no discards at eight clues and no clues at zero', () => {
		expect(getBotLegalActions(state({ clues: 8 }), 'bot').map(({ action }) => action.type)).toEqual(
			['play', 'clue', 'clue'],
		);
		expect(getBotLegalActions(state({ clues: 0 }), 'bot').map(({ action }) => action.type)).toEqual(
			['play', 'discard'],
		);
	});

	it.each([
		['5-color', { id: 'other', color: 'blue', number: 2 }, ['blue']],
		['6-color', { id: 'other', color: 'purple', number: 2 }, ['purple']],
		[
			'rainbow',
			{ id: 'other', color: 'rainbow', number: 2 },
			['red', 'blue', 'green', 'yellow', 'white'],
		],
		['black-powder', { id: 'other', color: 'black', number: 2 }, []],
		[
			'rainbow-black-powder',
			{ id: 'other', color: 'rainbow', number: 2 },
			['red', 'blue', 'green', 'yellow', 'white'],
		],
	] as const)('uses truthful color/rank clues for %s', (ruleSet, other, expectedColors) => {
		const game = state({ ruleSet });
		game.tiles = { ...game.tiles, other };
		const clues = getBotLegalActions(game, 'bot').flatMap(({ action }) =>
			action.type === 'clue' ? [action] : [],
		);
		expect(clues.filter((clue) => clue.color).map((clue) => clue.color)).toEqual(expectedColors);
		expect(clues.filter((clue) => clue.number).map((clue) => clue.number)).toEqual([2]);
		expect(clues.every((clue) => clue.to === 'human')).toBe(true);
	});

	it('keeps plays for every own card regardless of visual rearrangement', () => {
		const game = state();
		game.playerTiles = { ...game.playerTiles, bot: ['own', 'own-two'] };
		game.tilePositions = { own: { x: 110, y: 10, z: 0 }, 'own-two': { x: 10, y: 80, z: 0 } };
		// Missing hidden tile values deliberately prove that play/discard listing does not read them.
		expect(getBotLegalActions(game, 'bot').filter(({ action }) => action.type === 'play')).toEqual([
			{ id: 'action-0', action: { type: 'play', tileId: 'own' } },
			{ id: 'action-2', action: { type: 'play', tileId: 'own-two' } },
		]);
	});

	it('does not offer actions for non-current players, spectators, or inactive games', () => {
		expect(getBotLegalActions(state(), 'human')).toEqual([]);
		expect(getBotLegalActions(state(), 'spectator')).toEqual([]);
		expect(getBotLegalActions(state({ stage: HanabiStage.Setup }), 'bot')).toEqual([]);
		expect(getBotLegalActions(state({ stage: HanabiStage.Finished }), 'bot')).toEqual([]);
	});
});
