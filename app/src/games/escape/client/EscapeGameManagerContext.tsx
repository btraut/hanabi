import EscapeGameManager from 'app/src/games/escape/client/EscapeGameManager';
import { createContext, useContext } from 'react';

const context = createContext<EscapeGameManager | null>(null);

export function useEscapeGameManager(): EscapeGameManager {
	const contextValue = useContext(context);

	if (contextValue === null) {
		throw new Error('useEscapeGameManager must be used within a EscapeGameManagerContextProvider');
	}

	return contextValue;
}

export const EscapeGameManagerContextConsumer = context.Consumer;
export const EscapeGameManagerContextProvider = context.Provider;
