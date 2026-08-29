import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { getHanabiTileDragPreviewStyle } from './HanabiPlayerTilesDragLayer';

describe('HanabiPlayerTilesDragLayer', () => {
	it('uses the source client offset without board clamping', () => {
		expect(getHanabiTileDragPreviewStyle({ x: 512, y: 714 })).toMatchObject({
			position: 'fixed',
			transform: 'translate3d(512px, 714px, 0)',
		});
	});

	it('does not paint drop-zone outlines while dragging', () => {
		const source = readFileSync(
			new URL('./HanabiPlayerTilesDragLayer.tsx', import.meta.url),
			'utf8',
		);

		expect(source).not.toContain('border-hanabi-coral');
		expect(source).not.toContain('bg-hanabi-coral/10');
	});
});
