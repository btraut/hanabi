/* eslint-disable max-classes-per-file */

export interface HanabiAnimatablePlayTile {
	playerId: string;
	tileId: string;
}

export interface HanabiAnimatableDiscardTile {
	playerId: string;
	tileId: string;
}

export interface HanabiAnimatableDrawTile {
	playerId: string;
	tileId: string;
}

export type HanabiAnimatable =
	| HanabiAnimatablePlayTile
	| HanabiAnimatableDiscardTile
	| HanabiAnimatableDrawTile;
