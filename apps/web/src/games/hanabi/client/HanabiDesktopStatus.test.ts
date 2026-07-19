import {
	getHanabiDesktopStatusData,
	default as HanabiDesktopStatus,
} from '~/games/hanabi/client/HanabiDesktopStatus';
import { generateHanabiGameData, HanabiFinishedReason, HanabiStage } from '@hanabi/shared';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

const players = {
	alice: { connected: true, id: 'alice', name: 'Alice' },
	ben: { connected: true, id: 'ben', name: 'Ben' },
};

describe('HanabiDesktopStatus', () => {
	it('shows every resource, including zero values', () => {
		const gameData = generateHanabiGameData({
			clues: 0,
			currentPlayerId: 'alice',
			lives: 0,
			players,
			ruleSet: '5-color',
			stage: HanabiStage.Playing,
			turnOrder: ['alice', 'ben'],
		});
		const markup = renderToStaticMarkup(
			createElement(HanabiDesktopStatus, { gameData, userId: 'alice' }),
		);

		expect(markup).toContain('Your turn');
		expect(markup).toContain('Score');
		expect(markup).toContain('0/25');
		expect(markup).toContain('Deck');
		expect(markup.match(/>0</g)?.length).toBeGreaterThanOrEqual(3);
	});

	it('names another player, their connection state, and remaining turns', () => {
		const gameData = generateHanabiGameData({
			currentPlayerId: 'ben',
			players: { ...players, ben: { ...players.ben, connected: false } },
			remainingTurns: 1,
			stage: HanabiStage.Playing,
			turnOrder: ['alice', 'ben'],
		});

		expect(getHanabiDesktopStatusData(gameData, 'alice').turnLabel).toBe(
			'Ben’s turn · disconnected · 1 turn left',
		);
	});

	it('suppresses stale turn state after the game finishes', () => {
		const gameData = generateHanabiGameData({
			currentPlayerId: 'ben',
			finishedReason: HanabiFinishedReason.OutOfTurns,
			players,
			stage: HanabiStage.Finished,
			turnOrder: ['alice', 'ben'],
		});

		expect(getHanabiDesktopStatusData(gameData, 'alice').turnLabel).toBe('Game finished');
	});
});
