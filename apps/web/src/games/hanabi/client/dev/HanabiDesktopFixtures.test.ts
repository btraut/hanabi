import { getHanabiDesktopFixtures } from '~/games/hanabi/client/dev/HanabiDesktopFixtures';
import { getHanabiRuleSetColors, HANABI_BOARD_SIZE, HanabiStage } from '@hanabi/shared';
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

	it('models spectator, disconnected, and finished semantics', () => {
		const fixtures = getHanabiDesktopFixtures();

		expect(fixtures.spectator.gameData.players[fixtures.spectator.userId]).toBeUndefined();
		expect(fixtures.disconnected.gameData.players['player-2'].connected).toBe(false);
		expect(fixtures.finished.gameData.stage).toBe(HanabiStage.Finished);
		expect(fixtures.finished.gameData.currentPlayerId).toBeNull();
	});
});
