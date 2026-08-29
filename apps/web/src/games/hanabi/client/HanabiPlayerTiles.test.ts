import {
	getHanabiResponsivePreviewPositions,
	hasHanabiTileNotes,
	shouldShowHanabiPlayerTileEmphasis,
} from './HanabiPlayerTiles';
import {
	HANABI_DESKTOP_SURFACE_HEIGHT,
	HANABI_DESKTOP_TILE_INSET,
	HANABI_DESKTOP_TILE_SIZE,
	HANABI_DESKTOP_ZONE_HEIGHT,
	getHanabiDesktopOrderedTileSlot,
	getHanabiDesktopTileStyle,
	getHanabiDesktopTileVisualDimensions,
} from './HanabiDesktopTileGeometry';
import { describe, expect, it } from 'vitest';

describe('HanabiPlayerTiles notes indicator', () => {
	it('only marks cards that contain an actual note', () => {
		expect(hasHanabiTileNotes(undefined)).toBe(false);
		expect(hasHanabiTileNotes({ colors: [], numbers: [] })).toBe(false);
		expect(hasHanabiTileNotes({ colors: ['blue'], numbers: [] })).toBe(true);
		expect(hasHanabiTileNotes({ colors: [], numbers: [4] })).toBe(true);
	});
});

describe('HanabiPlayerTiles clue emphasis', () => {
	it('moves only the dragged card emphasis out of its source slot', () => {
		expect(shouldShowHanabiPlayerTileEmphasis(true, 'tile-a', undefined)).toBe(true);
		expect(shouldShowHanabiPlayerTileEmphasis(true, 'tile-a', 'tile-a')).toBe(false);
		expect(shouldShowHanabiPlayerTileEmphasis(true, 'tile-a', 'tile-b')).toBe(true);
		expect(shouldShowHanabiPlayerTileEmphasis(false, 'tile-a', undefined)).toBe(false);
	});
});

describe('HanabiPlayerTiles desktop placement', () => {
	it('leaves an insertion gap while reordering and compacts after entering freeform', () => {
		const playerTileIds = ['dragging', 'first', 'second', 'third', 'fourth'];
		const tilePositions = {
			dragging: { x: 10, y: 10, z: 0 },
			first: { x: 60, y: 10, z: 1 },
			second: { x: 110, y: 10, z: 2 },
			third: { x: 160, y: 10, z: 3 },
			fourth: { x: 210, y: 10, z: 4 },
		};

		const orderedPreview = getHanabiResponsivePreviewPositions({
			draggedPosition: { x: 110, y: 10, z: 0 },
			draggedTileId: 'dragging',
			playerTileIds,
			tilePositions,
		});
		const freeformPreview = getHanabiResponsivePreviewPositions({
			draggedPosition: { x: 110, y: 70, z: 0 },
			draggedTileId: 'dragging',
			playerTileIds,
			tilePositions,
		});

		expect(playerTileIds.slice(1).map((id) => orderedPreview?.[id].x)).toEqual([10, 60, 160, 210]);
		expect(playerTileIds.slice(1).map((id) => freeformPreview?.[id].x)).toEqual([10, 60, 110, 160]);
	});

	it('uses the same rendered dimensions for local and remote cards', () => {
		expect(getHanabiDesktopTileVisualDimensions(true)).toEqual({ height: 64, width: 50 });
		expect(getHanabiDesktopTileVisualDimensions(false)).toEqual({ height: 64, width: 50 });
	});

	it('left-aligns ordered cards at one fixed vertical inset', () => {
		const firstStyle = getHanabiDesktopTileStyle({
			hidden: true,
			position: { x: 10, y: 40, z: 0 },
			tileCount: 5,
		});
		const thirdStyle = getHanabiDesktopTileStyle({
			hidden: false,
			position: { x: 110, y: 10, z: 0 },
			tileCount: 5,
		});

		expect(firstStyle).toMatchObject({
			left: 'var(--hanabi-player-tile-slot-0)',
			top: 'var(--hanabi-player-tile-inset)',
		});
		expect(thirdStyle).toMatchObject({
			left: 'var(--hanabi-player-tile-slot-2)',
			top: 'var(--hanabi-player-tile-inset)',
		});
		expect(firstStyle.transform).toBeUndefined();
		expect(thirdStyle.transform).toBeUndefined();
	});

	it('preserves the insertion gap produced by an ordered-row hover', () => {
		const slots = [10, 60, 160, 210].map((x) =>
			getHanabiDesktopOrderedTileSlot({ x, y: 10, z: 0 }, 5),
		);

		expect(slots).toEqual([0, 1, 3, 4]);
	});

	it('maps the full logical freeform range onto the full visual zone', () => {
		const boundaryStyle = getHanabiDesktopTileStyle({
			hidden: true,
			position: { x: 120, y: 70, z: 4 },
			tileCount: 5,
		});
		const bottomStyle = getHanabiDesktopTileStyle({
			hidden: true,
			position: { x: 120, y: 92, z: 4 },
			tileCount: 5,
		});

		expect(boundaryStyle).toMatchObject({ top: '80px', transform: 'translateY(-0%)' });
		expect(bottomStyle).toMatchObject({ top: '176px', transform: 'translateY(-100%)' });
		expect(HANABI_DESKTOP_ZONE_HEIGHT).toBe(
			HANABI_DESKTOP_TILE_SIZE.height + HANABI_DESKTOP_TILE_INSET * 2,
		);
		expect(HANABI_DESKTOP_SURFACE_HEIGHT - HANABI_DESKTOP_ZONE_HEIGHT).toBeGreaterThan(
			HANABI_DESKTOP_ZONE_HEIGHT,
		);
	});
});
