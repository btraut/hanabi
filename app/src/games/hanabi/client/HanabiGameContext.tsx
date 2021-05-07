import HanabiGameMessenger from 'app/src/games/hanabi/client/HanabiGameMessenger';
import { HanabiGameData } from 'app/src/games/hanabi/HanabiGameData';
import { createContext, useContext } from 'react';

export interface HanabiGameContext {
	create(): Promise<string>;
	watch(code: string): Promise<void>;

	gameMessenger: HanabiGameMessenger | null;
	gameData: HanabiGameData | null;
	code: string | null;
}

const context = createContext<HanabiGameContext | null>(null);

// Custom hook to grab all of HanabiGameContext.
export function useHanabiGameContext(): HanabiGameContext {
	const contextValue = useContext(context);

	if (contextValue === null) {
		throw new Error('useHanabiGameContext must be used within a HanabiGameContextProvider.');
	}

	return contextValue;
}

export function useGameMessenger(): HanabiGameMessenger {
	const { gameMessenger } = useHanabiGameContext();

	if (!gameMessenger) {
		throw new Error('No game data loaded.');
	}

	return gameMessenger;
}

export function useGameData(): HanabiGameData {
	const { gameData } = useHanabiGameContext();

	if (!gameData) {
		throw new Error('No game data loaded.');
	}

	return gameData;
}

export const HanabiGameContextConsumer = context.Consumer;
export const HanabiGameContextProvider = context.Provider;
