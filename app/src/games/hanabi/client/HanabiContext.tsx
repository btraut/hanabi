import HanabiGame from 'app/src/games/hanabi/client/HanabiGame';
import useForceRefresh from 'app/src/utils/client/useForceRefresh';
import { createContext, useContext, useEffect, useRef } from 'react';

export interface HanabiContext {
	create(): Promise<HanabiGame>;
	watch(code: string): Promise<HanabiGame>;
	game: HanabiGame | null;
}

const context = createContext<HanabiContext | null>(null);

export function useHanabiContext(): HanabiContext {
	const contextValue = useContext(context);

	if (contextValue === null) {
		throw new Error('useHanabiContext must be used within a HanabiContextProvider');
	}

	return contextValue;
}

export function useHanabiGame(refreshOnUpdate = true): HanabiGame | null {
	const contextValue = useContext(context);

	if (contextValue === null) {
		throw new Error('useHanabiGame must be used within a HanabiContextProvider');
	}

	const game = contextValue.game;
	const gameOnUpdateSubscriptionIdRef = useRef<number | null>(null);

	const forceRefresh = useForceRefresh();

	// We need to update components whenever the game updates its state.
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

export const HanabiContextConsumer = context.Consumer;
export const HanabiContextProvider = context.Provider;
