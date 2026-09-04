import { HANABI_TILE_TOUCH_SLOP_PX, hasHanabiTouchMoved } from './HanabiTouchInteractions';
import { describe, expect, it } from 'vitest';

describe('Hanabi touch interactions', () => {
	it('keeps stationary and small touch movement available for a long press', () => {
		expect(hasHanabiTouchMoved({ x: 20, y: 30 }, { x: 20, y: 30 })).toBe(false);
		expect(
			hasHanabiTouchMoved({ x: 20, y: 30 }, { x: 20 + HANABI_TILE_TOUCH_SLOP_PX, y: 30 }),
		).toBe(false);
	});

	it('hands movement beyond the shared slop threshold to drag', () => {
		expect(
			hasHanabiTouchMoved({ x: 20, y: 30 }, { x: 20 + HANABI_TILE_TOUCH_SLOP_PX + 1, y: 30 }),
		).toBe(true);
	});
});
