// HanabiMoveTileContext is a place to store local edits of tile positions.
// Since HanabiGameContext stores gameData as a mirror of the server, it acts as
// the source of truth for what other players see. But, since dragging of tiles
// can cause re-positioning that is staged before committing, we'll use this
// context to store overrides.

import { Position } from 'app/src/games/hanabi/HanabiGameData';
import { createContext, useContext } from 'react';

export interface HanabiMoveTileContext {
	moveTiles: (positions: { [tileId: string]: Position }, commit: boolean) => Promise<void>;
	tilePositions: { readonly [tileId: string]: Position };
}

const context = createContext<HanabiMoveTileContext | null>(null);

// Custom hook to grab all of HanabiMoveTileContext.
export function useHanabiMoveTileContext(): HanabiMoveTileContext {
	const contextValue = useContext(context);

	if (contextValue === null) {
		throw new Error(
			'useHanabiMoveTileContext must be used within a HanabiMoveTileContextProvider.',
		);
	}

	return contextValue;
}

export const HanabiMoveTileContextConsumer = context.Consumer;
export const HanabiMoveTileContextProvider = context.Provider;
