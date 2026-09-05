import { getHanabiDesktopFixtures } from '~/games/hanabi/client/dev/HanabiDesktopFixtures';
import HanabiDesktopFixtureView from '~/games/hanabi/client/dev/HanabiDesktopFixtureView';
import {
	getHanabiRuleSetColors,
	HANABI_BOARD_SIZE,
	HANABI_DEFAULT_TILE_POSITIONS,
	HanabiStage,
	isTileInTopHalf,
} from '@hanabi/shared';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

describe('Hanabi desktop fixtures', () => {
	it('provides every named state with internally complete tile references', () => {
		const fixtures = getHanabiDesktopFixtures();

		expect(Object.keys(fixtures)).toEqual([
			'standard',
			'maximum',
			'six-color',
			'workspace',
			'activity',
			'spectator',
			'disconnected',
			'bot-thinking',
			'bot-error',
			'bot-clue',
			'bot-result',
			'finished',
		]);

		for (const fixture of Object.values(fixtures)) {
			const data = fixture.gameData;
			expect(new Set(data.actions.map((action) => action.id)).size).toBe(data.actions.length);
			const referencedTileIds = [
				...data.remainingTiles,
				...data.playedTiles,
				...data.discardedTiles,
				...Object.values(data.playerTiles).flat(),
			];
			for (const tileId of referencedTileIds) expect(data.tiles[tileId]).toBeDefined();
		}
	});

	it('renders purple cards in the six-color fixture', () => {
		const sixColor = getHanabiDesktopFixtures()['six-color'].gameData;
		const renderedTileIds = [
			...sixColor.playedTiles,
			...Object.values(sixColor.playerTiles).flat(),
		];

		expect(renderedTileIds.some((tileId) => sixColor.tiles[tileId].color === 'purple')).toBe(true);
	});

	it('shows clue-note markers on two concealed cards in the standard fixture', () => {
		const fixture = getHanabiDesktopFixtures().standard;
		const localHand = fixture.gameData.playerTiles[fixture.userId];

		expect(fixture.gameData.tileNotes[localHand[1]]).toEqual({ colors: ['green'], numbers: [2] });
		expect(fixture.gameData.tileNotes[localHand[4]]).toEqual({ colors: ['red'], numbers: [5] });
	});

	it('renders the standard fixture clue notes as two folded card corners', () => {
		const markup = renderToStaticMarkup(
			createElement(
				MemoryRouter,
				{ initialEntries: ['/dev/desktop/standard'] },
				createElement(
					Routes,
					null,
					createElement(Route, {
						element: createElement(HanabiDesktopFixtureView),
						path: '/dev/desktop/:fixture',
					}),
				),
			),
		);

		expect(markup.match(/hanabi-tile-note-marker/g)).toHaveLength(2);
	});

	it('renders the bot error above the board without a recovery control', () => {
		const markup = renderToStaticMarkup(
			createElement(
				MemoryRouter,
				{ initialEntries: ['/dev/desktop/bot-error'] },
				createElement(
					Routes,
					null,
					createElement(Route, {
						element: createElement(HanabiDesktopFixtureView),
						path: '/dev/desktop/:fixture',
					}),
				),
			),
		);

		expect(markup).toContain('role="status"');
		expect(markup).toContain('Bot 1: The bot request timed out. Retrying automatically.');
		expect(markup.indexOf('role="status"')).toBeLessThan(
			markup.indexOf('aria-label="Current turn"'),
		);
		expect(markup).not.toContain('>Retry</button>');
		expect(markup).not.toContain('hanabi-avatar-orbit');
	});

	it('models the maximum width and height constraints', () => {
		const maximum = getHanabiDesktopFixtures().maximum.gameData;

		expect(maximum.turnOrder).toHaveLength(5);
		expect(getHanabiRuleSetColors(maximum.ruleSet)).toHaveLength(7);
		expect(maximum.discardedTiles).toHaveLength(10);
		expect(maximum.discardedTiles.every((tileId) => maximum.tiles[tileId].color === 'red')).toBe(
			true,
		);
	});

	it('keeps fixture positions inside the logical workspace', () => {
		for (const position of Object.values(
			getHanabiDesktopFixtures().workspace.gameData.tilePositions,
		)) {
			expect(position.x).toBeGreaterThanOrEqual(0);
			expect(position.x).toBeLessThan(HANABI_BOARD_SIZE.width);
			expect(position.y).toBeGreaterThanOrEqual(0);
			expect(position.y).toBeLessThan(HANABI_BOARD_SIZE.height);
		}
	});

	it('packs every upper carousel into consecutive slots starting at the left', () => {
		for (const fixture of Object.values(getHanabiDesktopFixtures())) {
			const { playerTiles, tilePositions } = fixture.gameData;
			for (const tileIds of Object.values(playerTiles)) {
				const orderedPositions = tileIds
					.map((tileId) => tilePositions[tileId])
					.filter(isTileInTopHalf)
					.sort((a, b) => a.x - b.x);
				expect(orderedPositions.map(({ x, y }) => ({ x, y }))).toEqual(
					orderedPositions.map((_, index) => {
						const { x, y } = HANABI_DEFAULT_TILE_POSITIONS[index];
						return { x, y };
					}),
				);
			}
		}
	});

	it('models spectator, disconnected, and finished semantics', () => {
		const fixtures = getHanabiDesktopFixtures();

		expect(fixtures.spectator.gameData.players[fixtures.spectator.userId]).toBeUndefined();
		expect(fixtures.disconnected.gameData.players['player-2'].connected).toBe(false);
		expect(fixtures.finished.gameData.stage).toBe(HanabiStage.Finished);
		expect(fixtures.finished.gameData.currentPlayerId).toBeNull();
	});

	it.each(['clue', 'result'] as const)(
		'keeps the human active while a bot considers a %s',
		(opportunity) => {
			const fixture = getHanabiDesktopFixtures()[`bot-${opportunity}`];
			expect(fixture.gameData.currentPlayerId).toBe(fixture.userId);
			expect(fixture.gameData.players[fixture.userId].kind).not.toBe('bot');
			expect(fixture.gameData.bots?.turn).toEqual({
				playerId: 'player-2',
				status: 'thinking',
				canRetry: false,
				opportunity,
			});
		},
	);
});
