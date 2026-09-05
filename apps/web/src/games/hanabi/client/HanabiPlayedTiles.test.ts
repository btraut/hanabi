import { HanabiGameStore } from './HanabiGameStore';
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

vi.mock('~/games/hanabi/client/HanabiGameContext', async (importOriginal) => ({
	...(await importOriginal<typeof import('./HanabiGameContext')>()),
	useTransitioningTileId: () => 'played-1',
}));

describe('HanabiPlayedTiles', () => {
	it('keeps a placeholder beneath an inert played tile without hand-only decoration', () => {
		const playedTile = { id: 'played-1', color: 'red' as const, number: 1 as const };
		const discardedTile = { id: 'discarded-1', color: 'blue' as const, number: 3 as const };
		const gameData = generateHanabiGameData({
			stage: HanabiStage.Playing,
			tiles: { [discardedTile.id]: discardedTile, [playedTile.id]: playedTile },
			playedTiles: [playedTile.id],
			discardedTiles: [discardedTile.id],
		});
		const gameContext: HanabiGameContext = {
			create: vi.fn(),
			watch: vi.fn(),
			gameMessenger: null,
			store: new HanabiGameStore(gameData),
			code: 'test',
		};
		const highlightContext: HanabiHighlightContext = {
			highlightedTiles: new Set([playedTile.id]),
			highlightAction: vi.fn(),
			highlightedAction: null,
			highlightedLabel: null,
			highlightedRecipientId: null,
			highlightedTone: 'action',
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
		expect(markup).not.toContain('hanabi-tile-emphasis');
		expect(markup).not.toContain('cursor-');
		expect(markup).toContain('data-hanabi-tile-color="blue"');
	});
});
