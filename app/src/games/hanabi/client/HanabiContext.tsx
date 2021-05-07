import HanabiGameMessenger from 'app/src/games/hanabi/client/HanabiGameMessenger';
import { HanabiGameData } from 'app/src/games/hanabi/HanabiGameData';
import { createContext, useContext } from 'react';

export interface HanabiContext {
	create(): Promise<HanabiGameMessenger>;
	watch(code: string): Promise<HanabiGameMessenger>;
	gameMessenger: HanabiGameMessenger | null;
	gameData: HanabiGameData | null;
}

const context = createContext<HanabiContext | null>(null);

// Custom hook to grab all of HanabiContext.
export function useHanabiContext(): HanabiContext {
	const contextValue = useContext(context);

	if (contextValue === null) {
		throw new Error('useHanabiContext must be used within a HanabiContextProvider.');
	}

	return contextValue;
}

export function useGameMessenger(): HanabiGameMessenger {
	const { gameMessenger } = useHanabiContext();

	if (!gameMessenger) {
		throw new Error('No game data loaded.');
	}

	return gameMessenger;
}

export function useGameData(): HanabiGameData {
	const { gameData } = useHanabiContext();

	if (!gameData) {
		throw new Error('No game data loaded.');
	}

	return gameData;
}

export const HanabiContextConsumer = context.Consumer;
export const HanabiContextProvider = context.Provider;
