import { createContext, useContext } from 'react';

export interface HanabiHighlightTileContext {
	highlightTiles(tiles: Set<string>): void;
	highlightedTiles: Set<string>;
}

const context = createContext<HanabiHighlightTileContext | null>(null);

export function useHanabiHighlightTileContext(): HanabiHighlightTileContext {
	const contextValue = useContext(context);

	if (contextValue === null) {
		throw new Error(
			'useHanabiHighlightTileContext must be used within a HanabiHighlightTileContextProvider',
		);
	}

	return contextValue;
}

export const HanabiHighlightTileContextConsumer = context.Consumer;
export const HanabiHighlightTileContextProvider = context.Provider;
