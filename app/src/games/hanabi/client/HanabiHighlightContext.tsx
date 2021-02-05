import { createContext, useContext } from 'react';

export interface HanabiHighlightContext {
	highlightTiles(tiles: Set<string>): void;
	highlightedTiles: Set<string>;

	highlightAction(id: string | null): void;
	highlightedAction: string | null;
}

const context = createContext<HanabiHighlightContext | null>(null);

export function useHanabiHighlightContext(): HanabiHighlightContext {
	const contextValue = useContext(context);

	if (contextValue === null) {
		throw new Error(
			'useHanabiHighlightContext must be used within a HanabiHighlightContextProvider',
		);
	}

	return contextValue;
}

export const HanabiHighlightContextConsumer = context.Consumer;
export const HanabiHighlightContextProvider = context.Provider;
