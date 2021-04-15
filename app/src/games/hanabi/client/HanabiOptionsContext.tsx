import { createContext, useContext } from 'react';

export interface HanabiOptionsContext {
	playSounds: boolean;
	setPlaySounds: (newVal: boolean) => void;
}

const context = createContext<HanabiOptionsContext | null>(null);

export function useHanabiOptionsContext(): HanabiOptionsContext {
	const contextValue = useContext(context);

	if (contextValue === null) {
		throw new Error('useHanabiOptionsContext must be used within a HanabiOptionsContextProvider');
	}

	return contextValue;
}

export const HanabiOptionsContextConsumer = context.Consumer;
export const HanabiOptionsContextProvider = context.Provider;
