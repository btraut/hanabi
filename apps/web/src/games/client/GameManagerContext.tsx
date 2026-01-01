import GameManager from '~/games/client/GameManager';
import { createContext, useContext } from 'react';

const context = createContext<GameManager | null>(null);

export function useGameManager(): GameManager {
	const gameManager = useContext(context);

	if (gameManager === null) {
		throw new Error('useGameManager must be used within a GameManagerContextProvider');
	}

	return gameManager;
}

export const GameManagerContextConsumer = context.Consumer;
export const GameManagerContextProvider = context.Provider;
