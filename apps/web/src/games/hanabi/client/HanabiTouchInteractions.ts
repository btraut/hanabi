export const HANABI_TILE_LONG_PRESS_DELAY_MS = 450;
export const HANABI_TILE_TOUCH_SLOP_PX = 8;

export function hasHanabiTouchMoved(
	start: { x: number; y: number },
	current: { x: number; y: number },
): boolean {
	return Math.hypot(current.x - start.x, current.y - start.y) > HANABI_TILE_TOUCH_SLOP_PX;
}
