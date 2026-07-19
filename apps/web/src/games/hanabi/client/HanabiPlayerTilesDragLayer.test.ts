import { describe, expect, it } from 'vitest';
import { getHanabiTileDragPreview } from './HanabiPlayerTilesDragLayer';

describe('HanabiPlayerTilesDragLayer', () => {
	it('snaps the ordered preview while leaving the freeform ghost clamped in place', () => {
		expect(getHanabiTileDragPreview({ x: 42, y: 69, z: 3 })).toEqual({
			position: { x: 60, y: 10, z: 3 },
			zone: 'ordered',
		});
		expect(getHanabiTileDragPreview({ x: 42, y: 70, z: 3 })).toEqual({
			position: { x: 42, y: 70, z: 3 },
			zone: 'freeform',
		});
	});
});
