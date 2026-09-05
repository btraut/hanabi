import { describe, expect, it } from 'vitest';
import {
	getHanabiHandLayout,
	getHanabiPositionsForLayout,
	getNewPositionsForTiles,
	getPositionInContainer,
	isTileInTopHalf,
	normalizeLegacyHanabiTilePositions,
	packHanabiHandPositions,
} from './HanabiDragDropUtils.js';
import type { HanabiHandLayout } from './HanabiDragDropUtils.js';

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

	it('adds a drawn card at the right end without moving freeform cards', () => {
		const positions = getNewPositionsForTiles(
			{ drawn: { x: 400, y: 10, z: 0 } },
			{
				right: { x: 210, y: 10, z: 4 },
				left: { x: 60, y: 10, z: 1 },
				lower: { x: 36.5, y: 82.2, z: 3 },
			},
		);
		expect(positions.left.x).toBe(10);
		expect(positions.right.x).toBe(60);
		expect(positions.drawn.x).toBe(110);
		expect(positions.lower).toEqual({ x: 36.5, y: 82.2, z: 3 });
	});
});

describe('Hanabi semantic hand layouts', () => {
	it('projects only the hand with ordered queue slots and normalized lower positions', () => {
		expect(
			getHanabiHandLayout(['right', 'lowerTop', 'left', 'lowerBottom'], {
				right: { x: 110, y: 10, z: 0 },
				left: { x: 10, y: 10, z: 0 },
				lowerTop: { x: 360, y: 88.8, z: 12 },
				lowerBottom: { x: 0, y: 70, z: 4 },
				foreign: { x: 0, y: 10, z: 0 },
			}),
		).toEqual({
			orderedRow: ['left', 'right'],
			lowerArea: [
				{ tileId: 'lowerBottom', x: 0, y: 0, stackOrder: 0 },
				{ tileId: 'lowerTop', x: 1, y: 1, stackOrder: 1 },
			],
		});
	});

	it('uses hand order to break identical positions and stack heights deterministically', () => {
		expect(
			getHanabiHandLayout(['b', 'a', 'd', 'c'], {
				a: { x: 10, y: 10, z: 0 },
				b: { x: 10, y: 10, z: 0 },
				c: { x: 180, y: 79.4, z: 5 },
				d: { x: 180, y: 79.4, z: 5 },
			}),
		).toMatchObject({
			orderedRow: ['b', 'a'],
			lowerArea: [
				{ tileId: 'd', x: 0.5, stackOrder: 0 },
				{ tileId: 'c', x: 0.5, stackOrder: 1 },
			],
		});
	});

	it('validates a complete target and places the full cards inside their zones', () => {
		const layout: HanabiHandLayout = {
			orderedRow: ['b', 'a'],
			lowerArea: [
				{ tileId: 'd', x: 1, y: 1, stackOrder: 8 },
				{ tileId: 'c', x: 0, y: 0, stackOrder: 2 },
			],
		};
		expect(getHanabiPositionsForLayout(['a', 'b', 'c', 'd'], layout)).toEqual({
			b: { x: 10, y: 10, z: 0 },
			a: { x: 60, y: 10, z: 0 },
			d: { x: 360, y: 88.8, z: 8 },
			c: { x: 0, y: 70, z: 2 },
		});
	});

	it('round-trips the semantic ordering and lower placement', () => {
		const layout: HanabiHandLayout = {
			orderedRow: ['b', 'a'],
			lowerArea: [
				{ tileId: 'c', x: 0.2, y: 0.25, stackOrder: 0 },
				{ tileId: 'd', x: 0.6, y: 0.75, stackOrder: 1 },
			],
		};
		const positions = getHanabiPositionsForLayout(['a', 'b', 'c', 'd'], layout)!;
		const projected = getHanabiHandLayout(['a', 'b', 'c', 'd'], positions);
		expect(projected.orderedRow).toEqual(layout.orderedRow);
		for (const [index, placement] of projected.lowerArea.entries()) {
			expect(placement.tileId).toBe(layout.lowerArea[index].tileId);
			expect(placement.stackOrder).toBe(layout.lowerArea[index].stackOrder);
			expect(placement.x).toBeCloseTo(layout.lowerArea[index].x);
			expect(placement.y).toBeCloseTo(layout.lowerArea[index].y);
		}
	});

	it.each<[string, unknown]>([
		['null', null],
		['array', []],
		['missing row', { lowerArea: [] }],
		['invalid area', { orderedRow: ['a', 'b'], lowerArea: {} }],
		['missing card', { orderedRow: ['a'], lowerArea: [] }],
		['foreign card', { orderedRow: ['a', 'foreign'], lowerArea: [] }],
		['duplicate row card', { orderedRow: ['a', 'a'], lowerArea: [] }],
		['invalid row ID', { orderedRow: ['a', 42], lowerArea: [] }],
		['invalid lower entry', { orderedRow: ['a'], lowerArea: [null] }],
		[
			'duplicate across zones',
			{
				orderedRow: ['a', 'b'],
				lowerArea: [{ tileId: 'a', x: 0, y: 0, stackOrder: 0 }],
			},
		],
		[
			'duplicate stack order',
			{
				orderedRow: [],
				lowerArea: [
					{ tileId: 'a', x: 0, y: 0, stackOrder: 0 },
					{ tileId: 'b', x: 1, y: 1, stackOrder: 0 },
				],
			},
		],
	])('rejects %s without changing the target', (_name, layout) => {
		const before = structuredClone(layout);
		expect(getHanabiPositionsForLayout(['a', 'b'], layout)).toBeNull();
		expect(layout).toEqual(before);
	});

	it.each<[string, unknown]>([
		['x', -0.1],
		['x', 1.1],
		['x', NaN],
		['x', Infinity],
		['x', '0.5'],
		['y', -0.1],
		['y', 1.1],
		['y', -Infinity],
		['y', null],
		['stackOrder', -1],
		['stackOrder', 1.5],
		['stackOrder', NaN],
		['stackOrder', Number.MAX_SAFE_INTEGER + 1],
		['stackOrder', '1'],
	])('rejects invalid %s value %s', (field, value) => {
		expect(
			getHanabiPositionsForLayout(['a'], {
				orderedRow: [],
				lowerArea: [{ tileId: 'a', x: 0.5, y: 0.5, stackOrder: 0, [field]: value }],
			}),
		).toBeNull();
	});

	it('accepts an empty hand but rejects duplicated input IDs and overflowing queues', () => {
		expect(getHanabiPositionsForLayout([], { orderedRow: [], lowerArea: [] })).toEqual({});
		expect(
			getHanabiPositionsForLayout(['a', 'a'], { orderedRow: ['a'], lowerArea: [] }),
		).toBeNull();
		const tooMany = Array.from({ length: 9 }, (_, index) => String(index));
		expect(getHanabiPositionsForLayout(tooMany, { orderedRow: tooMany, lowerArea: [] })).toBeNull();
	});

	it('packs upper gaps while preserving lower coordinates, stacking, and input data', () => {
		const positions = Object.freeze({
			right: Object.freeze({ x: 260, y: 20, z: 3 }),
			left: Object.freeze({ x: 60, y: 10, z: 2 }),
			lowerA: Object.freeze({ x: 24.25, y: 70, z: 7 }),
			lowerB: Object.freeze({ x: 24.25, y: 70, z: 8 }),
			foreign: Object.freeze({ x: 10, y: 10, z: 0 }),
		});
		const packed = packHanabiHandPositions(['right', 'lowerA', 'left', 'lowerB'], positions);
		expect(packed).toEqual({
			right: { x: 60, y: 10, z: 3 },
			left: { x: 10, y: 10, z: 2 },
			lowerA: positions.lowerA,
			lowerB: positions.lowerB,
		});
		expect(packHanabiHandPositions(['right', 'lowerA', 'left', 'lowerB'], packed)).toEqual(packed);
		expect(positions.right.x).toBe(260);
	});

	it('provides deterministic defaults for an unpositioned card without a phantom draw', () => {
		expect(getHanabiHandLayout(['a'], {})).toEqual({ orderedRow: ['a'], lowerArea: [] });
		expect(packHanabiHandPositions(['a'], {})).toEqual({ a: { x: 10, y: 10, z: 0 } });
		expect(packHanabiHandPositions([], { departed: { x: 10, y: 10, z: 0 } })).toEqual({});
	});
});
