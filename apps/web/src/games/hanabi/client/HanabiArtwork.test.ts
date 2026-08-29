import {
	HANABI_BRAND_MARK_PATH,
	HANABI_TILE_BACK_PATH,
	getHanabiTableauEmblemPath,
	getHanabiTileFacePath,
} from './HanabiArtwork';
import { HANABI_TILE_COLORS } from '@hanabi/shared';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function publicAssetExists(runtimePath: string): boolean {
	return existsSync(resolve(process.cwd(), 'apps/web/public', runtimePath.slice(1)));
}

describe('Hanabi authored artwork', () => {
	it('routes card faces through Vite fingerprinting instead of stable public URLs', () => {
		const source = readFileSync(new URL('./HanabiArtwork.ts', import.meta.url), 'utf8');

		expect(
			source.match(/import \w+TileFaceUrl from '~\/assets\/hanabi\/card-faces\//g),
		).toHaveLength(HANABI_TILE_COLORS.length);
		expect(source).not.toContain('/images/hanabi/generated/card-faces/');
	});

	it('provides every canonical asset at its runtime path', () => {
		const publicPaths = [
			HANABI_BRAND_MARK_PATH,
			HANABI_TILE_BACK_PATH,
			...HANABI_TILE_COLORS.map(getHanabiTableauEmblemPath),
		];
		const tileFacePaths = HANABI_TILE_COLORS.map(getHanabiTileFacePath);

		expect(new Set([...publicPaths, ...tileFacePaths]).size).toBe(
			publicPaths.length + tileFacePaths.length,
		);
		expect(publicPaths.every(publicAssetExists)).toBe(true);
		expect(tileFacePaths.every((path) => path.endsWith('.png'))).toBe(true);
	});
});
