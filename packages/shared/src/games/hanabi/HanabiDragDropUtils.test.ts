import { describe, expect, it } from 'vitest';
import {
	getNewPositionsForTiles,
	getPositionInContainer,
	isTileInTopHalf,
	normalizeLegacyHanabiTilePositions,
} from './HanabiDragDropUtils.js';

describe('Hanabi workspace drag and drop', () => {
	it('uses the visible midpoint as the ordered/freeform boundary', () => {
		expect(isTileInTopHalf({ x: 0, y: 69, z: 0 })).toBe(true);
		expect(isTileInTopHalf({ x: 0, y: 70, z: 0 })).toBe(false);
	});

	it('normalizes only legacy freeform positions and is idempotent', () => {
		const original = {
			ordered: { x: 10, y: 57, z: 0 },
			legacyStart: { x: 71, y: 58, z: 3 },
			legacyEnd: { x: 109, y: 69, z: 8 },
			freeform: { x: 120, y: 70, z: 4 },
		};

		const normalized = normalizeLegacyHanabiTilePositions(original);

		expect(normalized).toEqual({
			ordered: original.ordered,
			legacyStart: { x: 71, y: 70, z: 3 },
			legacyEnd: { x: 109, y: 70, z: 8 },
			freeform: original.freeform,
		});
		expect(normalizeLegacyHanabiTilePositions(normalized)).toEqual(normalized);
	});

	it('inserts an ordered tile without losing or duplicating tiles', () => {
		const positions = getNewPositionsForTiles(
			{ dragging: { x: 55, y: 69, z: 2 } },
			{
				first: { x: 10, y: 10, z: 0 },
				second: { x: 60, y: 10, z: 1 },
				freeform: { x: 25, y: 80, z: 5 },
			},
		);

		expect(Object.keys(positions).sort()).toEqual(['dragging', 'first', 'freeform', 'second']);
		expect(positions.first).toEqual({ x: 10, y: 10, z: 0 });
		expect(positions.dragging).toEqual({ x: 60, y: 10, z: 5 });
		expect(positions.second).toEqual({ x: 110, y: 10, z: 1 });
		expect(positions.freeform).toEqual({ x: 25, y: 80, z: 5 });
	});

	it('preserves a freeform drop and raises it above overlapping tiles', () => {
		const positions = getNewPositionsForTiles(
			{ dragging: { x: 42, y: 70, z: 1 } },
			{
				ordered: { x: 85, y: 10, z: 2 },
				freeform: { x: 42, y: 70, z: 7 },
			},
		);

		expect(positions.dragging).toEqual({ x: 42, y: 70, z: 8 });
		expect(positions.freeform).toEqual({ x: 42, y: 70, z: 7 });
		expect(positions.ordered).toEqual({ x: 10, y: 10, z: 2 });
	});

	it('clamps the full tile within the workspace bounds', () => {
		expect(getPositionInContainer({ x: 10, y: 10, z: 4 }, { x: -100, y: -100 })).toEqual({
			x: 0,
			y: 0,
			z: 4,
		});
		expect(getPositionInContainer({ x: 10, y: 10, z: 4 }, { x: 1000, y: 1000 })).toEqual({
			x: 360,
			y: 88.8,
			z: 4,
		});
	});
});
