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
		expect(markup).toContain('data-status-icon="deck"');
		expect(markup).toContain('data-status-icon="clues"');
		expect(markup).toContain('data-status-icon="lives"');
		expect(markup).toContain('tile-back-firework-v5.png');
		expect(markup).toContain('class="hanabi-status-regions"');
		expect(markup).toContain('class="hanabi-mobile-game-menu"');
		expect(markup).toContain('aria-label="Open game menu"');
		expect(markup).not.toContain('h-[78px] w-[270px]');
		expect(markup).not.toContain('h-[86px] w-[650px]');
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
			"Ben's turn · disconnected · 1 turn left",
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

	it('shows a bot thinking or paused without marking it disconnected', () => {
		const gameData = generateHanabiGameData({
			currentPlayerId: 'ben',
			players: { ...players, ben: { ...players.ben, connected: false, kind: 'bot' } },
			stage: HanabiStage.Playing,
			turnOrder: ['alice', 'ben'],
			bots: {
				available: true,
				canManage: false,
				turn: { playerId: 'ben', status: 'thinking', canRetry: false },
			},
		});
		expect(getHanabiDesktopStatusData(gameData, 'alice').turnLabel).toBe('Ben · Thinking…');
		gameData.bots!.turn!.status = 'error';
		expect(getHanabiDesktopStatusData(gameData, 'alice').turnLabel).toBe('Ben · Paused');
		gameData.bots!.turn = null;
		expect(getHanabiDesktopStatusData(gameData, 'alice').turnLabel).toBe("Ben's turn");
	});

	it.each(['clue', 'result'] as const)(
		'keeps the actual human turn label while a bot considers a %s or pauses',
		(opportunity) => {
			const gameData = generateHanabiGameData({
				currentPlayerId: 'alice',
				players: { ...players, ben: { ...players.ben, connected: false, kind: 'bot' } },
				stage: HanabiStage.Playing,
				turnOrder: ['alice', 'ben'],
				bots: {
					available: true,
					canManage: false,
					turn: { playerId: 'ben', status: 'thinking', canRetry: false, opportunity },
				},
			});
			expect(getHanabiDesktopStatusData(gameData, 'alice').turnLabel).toBe('Your turn');
			expect(getHanabiDesktopStatusData(gameData, 'spectator').turnLabel).toBe("Alice's turn");
			gameData.bots!.turn!.status = 'error';
			expect(getHanabiDesktopStatusData(gameData, 'alice').turnLabel).toBe('Your turn');
		},
	);
});
