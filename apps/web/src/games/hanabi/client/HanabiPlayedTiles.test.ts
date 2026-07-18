import {
	HanabiGameContext,
	HanabiGameContextProvider,
} from '~/games/hanabi/client/HanabiGameContext';
import {
	HanabiHighlightContext,
	HanabiHighlightContextProvider,
} from '~/games/hanabi/client/HanabiHighlightContext';
import HanabiPlayedTiles from '~/games/hanabi/client/HanabiPlayedTiles';
import { generateHanabiGameData, HanabiStage } from '@hanabi/shared';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

describe('HanabiPlayedTiles', () => {
	it('keeps a placeholder beneath an inert played tile without hand-only decoration', () => {
		const playedTile = { id: 'played-1', color: 'red' as const, number: 1 as const };
		const gameData = generateHanabiGameData({
			stage: HanabiStage.Playing,
			tiles: { [playedTile.id]: playedTile },
			playedTiles: [playedTile.id],
		});
		const gameContext: HanabiGameContext = {
			create: vi.fn(),
			watch: vi.fn(),
			gameMessenger: null,
			gameData,
			transitioningTileId: playedTile.id,
			code: 'test',
		};
		const highlightContext: HanabiHighlightContext = {
			highlightTiles: vi.fn(),
			highlightedTiles: new Set([playedTile.id]),
			highlightAction: vi.fn(),
			highlightedAction: null,
		};

		const markup = renderToStaticMarkup(
			createElement(
				HanabiGameContextProvider,
				{ value: gameContext },
				createElement(
					HanabiHighlightContextProvider,
					{ value: highlightContext },
					createElement(HanabiPlayedTiles),
				),
			),
		);

		expect(markup.match(/hanabi-firework-placeholder/g)).toHaveLength(25);
		expect(markup).toContain('view-transition-name:hanabi-tile-played-1');
		expect(markup).not.toContain('marquee-highlight');
		expect(markup).not.toContain('cursor-');
	});
});
