import {
	HANABI_BRAND_MARK_PATH,
	HANABI_TILE_BACK_EMBLEM_PATH,
	HANABI_TILE_FACE_BURST_PATH,
	getHanabiTableauEmblemPath,
} from './HanabiArtwork';
import { HANABI_TILE_COLORS } from '@hanabi/shared';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function publicAssetExists(runtimePath: string): boolean {
	return existsSync(resolve(process.cwd(), 'apps/web/public', runtimePath.slice(1)));
}

describe('Hanabi authored artwork', () => {
	it('provides every canonical asset at its runtime path', () => {
		const paths = [
			HANABI_BRAND_MARK_PATH,
			HANABI_TILE_FACE_BURST_PATH,
			HANABI_TILE_BACK_EMBLEM_PATH,
			...HANABI_TILE_COLORS.map(getHanabiTableauEmblemPath),
		];

		expect(new Set(paths).size).toBe(11);
		expect(paths.every(publicAssetExists)).toBe(true);
	});
});
