import { HanabiTileColor } from '@hanabi/shared';

export const HANABI_BRAND_MARK_PATH = '/images/hanabi/brand-mark.svg';
export const HANABI_TILE_FACE_BURST_PATH = '/images/hanabi/tile-face-burst.svg';
export const HANABI_TILE_BACK_EMBLEM_PATH = '/images/hanabi/tile-back-emblem.svg';

export function getHanabiTableauEmblemPath(color: HanabiTileColor): string {
	return `/images/hanabi/tableau/${color}.svg`;
}
