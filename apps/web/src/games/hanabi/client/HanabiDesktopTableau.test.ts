import {
	getHanabiDiscardsForColor,
	getHanabiPlayedTopTile,
	default as HanabiDesktopTableau,
} from '~/games/hanabi/client/HanabiDesktopTableau';
import { generateHanabiGameData, HanabiTile, HanabiTileColor } from '@hanabi/shared';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

function tile(id: string, color: HanabiTileColor, number: 1 | 2 | 3 | 4 | 5): HanabiTile {
	return { color, id, number };
}

describe('HanabiDesktopTableau', () => {
	it('renders every played tile as an ordered, persistent firework stack', () => {
		const tiles = {
			r1: tile('r1', 'red', 1),
			r2: tile('r2', 'red', 2),
			r3: tile('r3', 'red', 3),
		};
		const gameData = generateHanabiGameData({ playedTiles: ['r3', 'r1', 'r2'], tiles });
		const markup = renderToStaticMarkup(
			createElement(HanabiDesktopTableau, { gameData, transitioningTileId: 'r3' }),
		);

		expect(getHanabiPlayedTopTile(gameData, 'red')).toEqual(tiles.r3);
		expect(markup.match(/data-tableau-color=/g)).toHaveLength(5);
		expect(markup).toContain('red firework at 3');
		expect(markup).toContain('data-played-count="3"');
		expect(markup).toContain('data-played-number="1"');
		expect(markup).toContain('data-played-number="2"');
		expect(markup).toContain('data-played-number="3"');
		expect(markup.indexOf('data-played-number="1"')).toBeLessThan(
			markup.indexOf('data-played-number="2"'),
		);
		expect(markup.indexOf('data-played-number="2"')).toBeLessThan(
			markup.indexOf('data-played-number="3"'),
		);
		expect(markup).toContain('view-transition-name:hanabi-tile-r3');
		expect(markup).not.toContain('hanabi-firework-placeholder');
		expect(markup).not.toContain('ring-1 ring-current/25');
		expect(markup).not.toContain('border-r border-current/15');
		expect(markup).not.toContain('border-l-[3px]');
		expect(markup).not.toContain('shadow-light');
		expect(markup).toContain('height:64px;width:50px');
		expect(markup).not.toContain('grid-cols-[');
		expect(markup).toContain('--hanabi-tableau-row-height:80px');
		expect(markup).toContain('gap-[13px]');
		expect(markup).toContain('hanabi-tableau-emblem h-full object-contain');
		expect(markup).toContain('class="hanabi-tableau-divider"');
		expect(markup).toContain('hanabi-tableau-discards min-w-0');
		expect(markup.match(/src="\/images\/hanabi\/generated\/card-emblems\//g)).toHaveLength(5);
		expect(markup).not.toContain('mask:');
	});

	it('uses firework sequence order for black-powder top tiles', () => {
		const tiles = {
			b5: tile('b5', 'black', 5),
			b4: tile('b4', 'black', 4),
			b3: tile('b3', 'black', 3),
		};
		const gameData = generateHanabiGameData({
			playedTiles: ['b3', 'b5', 'b4'],
			ruleSet: 'black-powder',
			tiles,
		});
		const markup = renderToStaticMarkup(createElement(HanabiDesktopTableau, { gameData }));

		expect(getHanabiPlayedTopTile(gameData, 'black')).toEqual(tiles.b3);
		expect(markup).toContain('data-played-count="3"');
		expect(markup.indexOf('data-played-number="5"')).toBeLessThan(
			markup.indexOf('data-played-number="4"'),
		);
		expect(markup.indexOf('data-played-number="4"')).toBeLessThan(
			markup.indexOf('data-played-number="3"'),
		);
	});

	it('preserves every same-color discard in global chronology, including duplicates', () => {
		const orderedTiles = [
			tile('red-4-a', 'red', 4),
			tile('blue-1', 'blue', 1),
			tile('red-2', 'red', 2),
			tile('red-4-b', 'red', 4),
		];
		const tiles = Object.fromEntries(orderedTiles.map((item) => [item.id, item]));
		const gameData = generateHanabiGameData({
			discardedTiles: orderedTiles.map((item) => item.id),
			tiles,
		});

		expect(getHanabiDiscardsForColor(gameData, 'red').map((item) => item.id)).toEqual([
			'red-4-a',
			'red-2',
			'red-4-b',
		]);
	});

	it('renders all ten fixed-size discards and keeps transition identity', () => {
		const discarded = Array.from({ length: 10 }, (_, index) =>
			tile(`red-${index}`, 'red', (((index + 1) % 5) + 1) as 1 | 2 | 3 | 4 | 5),
		);
		const tiles = Object.fromEntries(discarded.map((item) => [item.id, item]));
		const gameData = generateHanabiGameData({
			discardedTiles: discarded.map((item) => item.id),
			tiles,
		});
		const markup = renderToStaticMarkup(
			createElement(HanabiDesktopTableau, { gameData, transitioningTileId: 'red-9' }),
		);

		expect(markup).toContain('data-discard-count="10"');
		expect(markup).toContain('data-discard-gap="-17"');
		expect(markup).toContain('view-transition-name:hanabi-tile-red-9');
		expect(markup.match(/role="listitem"/g)).toHaveLength(10);
	});

	it.each([
		['6-color', 6],
		['rainbow', 6],
		['black-powder', 6],
		['rainbow-black-powder', 7],
	] as const)('renders every active lane for %s', (ruleSet, laneCount) => {
		const gameData = generateHanabiGameData({ ruleSet });
		const markup = renderToStaticMarkup(createElement(HanabiDesktopTableau, { gameData }));

		expect(markup.match(/data-tableau-color=/g)).toHaveLength(laneCount);
		expect(markup).toContain('class="sr-only"');
	});
});
