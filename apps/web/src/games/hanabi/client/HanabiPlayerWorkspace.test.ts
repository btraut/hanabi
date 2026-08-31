import {
	getHanabiPlayerAccent,
	getHanabiPlayerDisplayOrder,
	HANABI_PLAYER_ACCENTS,
	HanabiDesktopPlayerWorkspaces,
} from '~/games/hanabi/client/HanabiPlayerWorkspace';
import { getHanabiPlayerTilePermissions } from '~/games/hanabi/client/HanabiPlayerTiles';
import { generateHanabiGameData, HanabiFinishedReason, HanabiStage } from '@hanabi/shared';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

const players = {
	alice: { connected: true, id: 'alice', name: 'Alice' },
	ben: { connected: true, id: 'ben', name: 'Ben' },
	chika: { connected: false, id: 'chika', name: 'Chika' },
};

describe('HanabiPlayerWorkspace', () => {
	it('rotates the local player first without changing stable relative order', () => {
		expect(getHanabiPlayerDisplayOrder(['alice', 'ben', 'chika'], 'ben')).toEqual([
			'ben',
			'chika',
			'alice',
		]);
		expect(getHanabiPlayerDisplayOrder(['alice', 'ben'], 'spectator')).toEqual(['alice', 'ben']);
	});

	it('uses the same local-first identity colors everywhere', () => {
		const turnOrder = ['alice', 'ben', 'chika'];

		expect(getHanabiPlayerAccent(turnOrder, 'ben', 'ben')).toBe(HANABI_PLAYER_ACCENTS[0]);
		expect(getHanabiPlayerAccent(turnOrder, 'ben', 'chika')).toBe(HANABI_PLAYER_ACCENTS[1]);
		expect(getHanabiPlayerAccent(turnOrder, 'ben', 'alice')).toBe(HANABI_PLAYER_ACCENTS[2]);
	});

	it('marks only the active in-progress player and preserves offline/local identity', () => {
		const gameData = generateHanabiGameData({
			currentPlayerId: 'chika',
			players,
			stage: HanabiStage.Playing,
			turnOrder: ['alice', 'ben', 'chika'],
		});
		const markup = renderToStaticMarkup(
			createElement(HanabiDesktopPlayerWorkspaces, {
				gameData,
				renderTileSurface: (id: string) => createElement('div', { 'data-surface': id }),
				userId: 'ben',
			}),
		);

		expect(markup.match(/Playing/g)).toHaveLength(1);
		expect(markup).toContain('aria-label="Chika, playing"');
		expect(markup).toContain('aria-label="Ben, you"');
		expect(markup.match(/data-hanabi-player-avatar=/g)).toHaveLength(3);
		expect(markup).toContain('data-hanabi-player-avatar="ben"');
		expect(markup).toContain('Offline');
		expect(markup).toContain('grid-cols-[80px_minmax(0,1fr)]');
		expect(markup).not.toContain('uppercase');
		expect(markup).not.toContain('tracking-[0.12em]');
		expect(markup.indexOf('data-surface="ben"')).toBeLessThan(
			markup.indexOf('data-surface="chika"'),
		);
	});

	it('suppresses stale Playing treatment after finish', () => {
		const gameData = generateHanabiGameData({
			currentPlayerId: 'alice',
			finishedReason: HanabiFinishedReason.OutOfTurns,
			players,
			stage: HanabiStage.Finished,
			turnOrder: ['alice', 'ben', 'chika'],
		});
		const markup = renderToStaticMarkup(
			createElement(HanabiDesktopPlayerWorkspaces, {
				gameData,
				renderTileSurface: () => createElement('div'),
				userId: 'alice',
			}),
		);

		expect(markup).not.toContain('Playing');
		expect(markup).not.toContain('border-hanabi-coral');
	});

	it('keeps the zones visually unlabeled', () => {
		const gameData = generateHanabiGameData({
			players,
			stage: HanabiStage.Playing,
			turnOrder: ['alice', 'ben', 'chika'],
		});
		const markup = renderToStaticMarkup(
			createElement(HanabiDesktopPlayerWorkspaces, {
				gameData,
				renderTileSurface: () => createElement('div'),
				userId: 'alice',
			}),
		);

		expect(markup).not.toContain('Auto');
		expect(markup).not.toContain('Freeform');
	});

	it('uses one workspace height for every player', () => {
		const gameData = generateHanabiGameData({
			players,
			stage: HanabiStage.Playing,
			turnOrder: ['alice', 'ben', 'chika'],
		});
		const markup = renderToStaticMarkup(
			createElement(HanabiDesktopPlayerWorkspaces, {
				gameData,
				renderTileSurface: () => createElement('div'),
				userId: 'alice',
			}),
		);

		expect(markup.match(/h-\[186px\]/g)).toHaveLength(3);
		expect(markup).not.toContain('h-[154px]');
		expect(markup).not.toContain('h-[174px]');
	});

	it('preserves concealment, action, and drag permissions', () => {
		const playing = generateHanabiGameData({
			allowDragging: true,
			currentPlayerId: 'alice',
			stage: HanabiStage.Playing,
		});

		expect(
			getHanabiPlayerTilePermissions({
				gameData: playing,
				isTransitioning: false,
				playerId: 'alice',
				userId: 'alice',
			}),
		).toEqual({ canAct: true, draggable: true, hidden: true, ownTiles: true });
		expect(
			getHanabiPlayerTilePermissions({
				gameData: playing,
				isTransitioning: false,
				playerId: 'ben',
				userId: 'alice',
			}),
		).toEqual({ canAct: true, draggable: false, hidden: false, ownTiles: false });
		expect(
			getHanabiPlayerTilePermissions({
				gameData: { ...playing, finishedReason: HanabiFinishedReason.OutOfTurns },
				isTransitioning: false,
				playerId: 'alice',
				userId: 'alice',
			}),
		).toEqual({ canAct: false, draggable: false, hidden: false, ownTiles: true });
	});
});
