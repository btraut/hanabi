import { createContext, useContext } from 'react';

export type HanabiNewestTileContext = string | null;

const context = createContext<HanabiNewestTileContext | void>(undefined);

export function useNewestTile(): HanabiNewestTileContext {
	const contextValue = useContext(context);

	if (typeof contextValue === 'undefined') {
		throw new Error('useNewestTile must be used within a HanabiNewestTileContextProvider');
	}

	return contextValue;
}

export const HanabiNewestTileContextConsumer = context.Consumer;
export const HanabiNewestTileContextProvider = context.Provider;
