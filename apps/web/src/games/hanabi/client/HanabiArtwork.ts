import { HanabiTileColor } from '@hanabi/shared';
import blackTileFaceUrl from '~/assets/hanabi/card-faces/black.png';
import blueTileFaceUrl from '~/assets/hanabi/card-faces/blue.png';
import greenTileFaceUrl from '~/assets/hanabi/card-faces/green.png';
import purpleTileFaceUrl from '~/assets/hanabi/card-faces/purple.png';
import rainbowTileFaceUrl from '~/assets/hanabi/card-faces/rainbow.png';
import redTileFaceUrl from '~/assets/hanabi/card-faces/red.png';
import whiteTileFaceUrl from '~/assets/hanabi/card-faces/white.png';
import yellowTileFaceUrl from '~/assets/hanabi/card-faces/yellow.png';

export const HANABI_BRAND_MARK_PATH = '/images/hanabi/generated/brand-mark-v2.png';
export const HANABI_TILE_BACK_PATH = '/images/hanabi/generated/tile-back-firework-v5.png';

const HANABI_TILE_FACE_PATHS: Record<HanabiTileColor, string> = {
	black: blackTileFaceUrl,
	blue: blueTileFaceUrl,
	green: greenTileFaceUrl,
	purple: purpleTileFaceUrl,
	rainbow: rainbowTileFaceUrl,
	red: redTileFaceUrl,
	white: whiteTileFaceUrl,
	yellow: yellowTileFaceUrl,
};

export function getHanabiTileFacePath(color: HanabiTileColor): string {
	return HANABI_TILE_FACE_PATHS[color];
}

export function getHanabiTableauEmblemPath(color: HanabiTileColor): string {
	return `/images/hanabi/generated/card-emblems/${color}.png`;
}
