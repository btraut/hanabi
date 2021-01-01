import EscapeGameManager from 'app/src/games/escape/client/EscapeGameManager';
import useForceRefresh from 'app/src/utils/client/useForceRefresh';
import { createContext, useContext, useEffect, useRef } from 'react';

const context = createContext<EscapeGameManager | null>(null);

export function useEscapeGameManager(refreshOnUpdate = true): EscapeGameManager {
	// Grab the game manager from context.
	const gameManager = useContext(context);
	const gameManagerOnUpdateSubscriptionIdRef = useRef<number | null>(null);

	const forceRefresh = useForceRefresh();

	// We need to update components whenever the game manager updates its state.
	// It's expected that
	useEffect(() => {
		if (gameManager && refreshOnUpdate) {
			gameManagerOnUpdateSubscriptionIdRef.current = gameManager.onUpdate.subscribe(forceRefresh);
		}

		return () => {
			if (gameManager && gameManagerOnUpdateSubscriptionIdRef.current !== null) {
				gameManager.onUpdate.unsubscribe(gameManagerOnUpdateSubscriptionIdRef.current);
				gameManagerOnUpdateSubscriptionIdRef.current = null;
			}
		};
	}, [forceRefresh, gameManager, refreshOnUpdate]);

	if (gameManager === null) {
		throw new Error('useEscapeGameManager must be used within a EscapeGameManagerContextProvider');
	}

	return gameManager;
}

export const EscapeGameManagerContextConsumer = context.Consumer;
export const EscapeGameManagerContextProvider = context.Provider;
