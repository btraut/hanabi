import { getHanabiPositionForDrag, scaleHanabiDragDelta } from './HanabiDragTypes';
import { describe, expect, it } from 'vitest';

describe('responsive Hanabi drag geometry', () => {
	it('maps rendered pointer movement back into the canonical board', () => {
		expect(
			scaleHanabiDragDelta(
				{ x: 85, y: 70 },
				{ width: 340, height: 140 },
				{ width: 400, height: 140 },
			),
		).toEqual({ x: 100, y: 70 });
	});

	it('preserves slot-relative movement in the ordered row', () => {
		expect(
			getHanabiPositionForDrag(
				{
					highlight: false,
					highlightTone: 'action',
					id: 'tile-1',
					notesIndicator: false,
					originalPosition: { x: 210, y: 10, z: 3 },
					responsiveSurface: false,
					renderedTileSize: { height: 51.2, width: 40 },
					sourcePosition: { x: 350, y: 10 },
					surfaceSize: { width: 500, height: 140 },
					type: 'tile',
				},
				{ x: -50, y: 0 },
			),
		).toEqual({ x: 170, y: 10, z: 3 });
	});

	it('uses the rendered source position when entering freeform', () => {
		expect(
			getHanabiPositionForDrag(
				{
					highlight: false,
					highlightTone: 'action',
					id: 'tile-1',
					notesIndicator: false,
					originalPosition: { x: 210, y: 10, z: 3 },
					responsiveSurface: false,
					renderedTileSize: { height: 51.2, width: 40 },
					sourcePosition: { x: 350, y: 10 },
					surfaceSize: { width: 500, height: 140 },
					type: 'tile',
				},
				{ x: -150, y: 80 },
			),
		).toEqual({ x: 160, y: 88.8, z: 3 });
	});

	it('maps responsive ordered slots and the entire freeform zone', () => {
		const item = {
			highlight: false,
			highlightTone: 'action' as const,
			id: 'tile-1',
			notesIndicator: false,
			originalPosition: { x: 10, y: 10, z: 3 },
			responsiveSurface: true,
			renderedTileSize: { height: 64, width: 50 },
			sourcePosition: { x: 8, y: 8 },
			surfaceSize: { width: 400, height: 184 },
			type: 'tile',
		};

		expect(getHanabiPositionForDrag(item, { x: 68, y: 0 })).toEqual({ x: 60, y: 10, z: 3 });
		expect(getHanabiPositionForDrag(item, { x: 100, y: 104 })).toEqual({
			x: 108,
			y: 88.8,
			z: 3,
		});
	});

	it('uses the compact rendered card pitch on narrow phones', () => {
		const item = {
			highlight: false,
			highlightTone: 'action' as const,
			id: 'tile-1',
			notesIndicator: false,
			originalPosition: { x: 10, y: 10, z: 3 },
			responsiveSurface: true,
			renderedTileSize: { height: 54, width: 54 },
			sourcePosition: { x: 8, y: 8 },
			surfaceSize: { width: 298, height: 184 },
			type: 'tile',
		};

		expect(getHanabiPositionForDrag(item, { x: 58, y: 0 })).toEqual({ x: 60, y: 10, z: 3 });
	});
});
