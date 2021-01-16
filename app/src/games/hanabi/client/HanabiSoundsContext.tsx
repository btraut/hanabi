import { createContext, useContext } from 'react';

export interface HanabiSoundsContext {
	playRight: () => void;
	playWrong: () => void;
	playBeep: () => void;
}

const context = createContext<HanabiSoundsContext | null>(null);

export function useHanabiSoundsContext(): HanabiSoundsContext {
	const contextValue = useContext(context);

	if (contextValue === null) {
		throw new Error('useHanabiSoundsContext must be used within a HanabiSoundsContextProvider');
	}

	return contextValue;
}

export const HanabiSoundsContextConsumer = context.Consumer;
export const HanabiSoundsContextProvider = context.Provider;
