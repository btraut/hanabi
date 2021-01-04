import EscapeGame from 'app/src/games/escape/client/EscapeGame';
import useForceRefresh from 'app/src/utils/client/useForceRefresh';
import { createContext, useContext, useEffect, useRef } from 'react';

export interface EscapeContext {
	create(): Promise<EscapeGame>;
	watch(code: string): Promise<EscapeGame>;
	game: EscapeGame | null;
}

const context = createContext<EscapeContext | null>(null);

export function useEscapeContext(): EscapeContext {
	const contextValue = useContext(context);

	if (contextValue === null) {
		throw new Error('useEscapeContext must be used within a EscapeContextProvider');
	}

	return contextValue;
}

export function useEscapeGame(refreshOnUpdate = true): EscapeGame | null {
	const contextValue = useContext(context);

	if (contextValue === null) {
		throw new Error('useEscapeGame must be used within a EscapeContextProvider');
	}

	const game = contextValue.game;
	const gameOnUpdateSubscriptionIdRef = useRef<number | null>(null);

	const forceRefresh = useForceRefresh();

	// We need to update components whenever the game updates its state.
	// It's expected that
	useEffect(() => {
		if (game && refreshOnUpdate) {
			gameOnUpdateSubscriptionIdRef.current = game.onUpdate.subscribe(forceRefresh);
		}

		return () => {
			if (game && gameOnUpdateSubscriptionIdRef.current !== null) {
				game.onUpdate.unsubscribe(gameOnUpdateSubscriptionIdRef.current);
				gameOnUpdateSubscriptionIdRef.current = null;
			}
		};
	}, [forceRefresh, game, refreshOnUpdate]);

	return game;
}

export const EscapeContextConsumer = context.Consumer;
export const EscapeContextProvider = context.Provider;
