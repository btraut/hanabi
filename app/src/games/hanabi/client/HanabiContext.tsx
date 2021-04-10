import HanabiAnimationManager from 'app/src/games/hanabi/client/HanabiAnimationManager';
import HanabiGame from 'app/src/games/hanabi/client/HanabiGame';
import useForceRefresh from 'app/src/utils/client/useForceRefresh';
import { createContext, useContext, useEffect, useRef } from 'react';

export interface HanabiContext {
	create(): Promise<HanabiGame>;
	watch(code: string): Promise<HanabiGame>;
	game: HanabiGame | null;
	animationManager: HanabiAnimationManager | null;
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

// useHanabiGame digs a HanabiGame out of HanabiContext, but also subscribes to
// updates to the game.
export function useHanabiGame(): HanabiGame {
	const contextValue = useContext(context);

	if (contextValue === null) {
		throw new Error('useHanabiGame must be used within a HanabiContextProvider.');
	}

	const { game } = contextValue;

	if (!game) {
		throw new Error('useHanabiGame expects a game to be loaded in context.');
	}

	const gameOnUpdateSubscriptionIdRef = useRef<number | null>(null);

	const forceRefresh = useForceRefresh();

	// We need to update components whenever the game updates its state.
	useEffect(() => {
		if (game) {
			gameOnUpdateSubscriptionIdRef.current = game.onUpdate.subscribe(forceRefresh);
		}

		return () => {
			if (game && gameOnUpdateSubscriptionIdRef.current !== null) {
				game.onUpdate.unsubscribe(gameOnUpdateSubscriptionIdRef.current);
				gameOnUpdateSubscriptionIdRef.current = null;
			}
		};
	}, [forceRefresh, game]);

	return game;
}

// Just like useHanabiGame, useHanabiAnimationManager digs a class out of
// HanabiContext, but this time, an animation manager. Animation managers
// also subscribe to changes in game state, so it's likely you'd use either
// useHanabiGame or useHanabiAnimationManager but not both.
export function useHanabiAnimationManager(refreshOnUpdate = true): HanabiAnimationManager | null {
	const contextValue = useContext(context);

	if (contextValue === null) {
		throw new Error('useHanabiGame must be used within a HanabiContextProvider');
	}

	const animationManager = contextValue.animationManager;
	const animationManagerOnUpdateSubscriptionIdRef = useRef<number | null>(null);

	const forceRefresh = useForceRefresh();

	// We need to update components whenever the game updates its state.
	useEffect(() => {
		if (animationManager && refreshOnUpdate) {
			animationManagerOnUpdateSubscriptionIdRef.current = animationManager.onUpdate.subscribe(
				forceRefresh,
			);
		}

		return () => {
			if (animationManager && animationManagerOnUpdateSubscriptionIdRef.current !== null) {
				animationManager.onUpdate.unsubscribe(animationManagerOnUpdateSubscriptionIdRef.current);
				animationManagerOnUpdateSubscriptionIdRef.current = null;
			}
		};
	}, [forceRefresh, animationManager, refreshOnUpdate]);

	return animationManager;
}

export const HanabiContextConsumer = context.Consumer;
export const HanabiContextProvider = context.Provider;
