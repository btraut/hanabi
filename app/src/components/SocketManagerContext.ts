import { createContext, useContext } from 'react';

import SocketManager from '../utils/client/SocketManager';

const context = createContext<SocketManager | null>(null);

export function useSocketManagerContext(): SocketManager {
	const contextValue = useContext(context);

	if (contextValue === null) {
		throw new Error('useSocketManagerContext must be used within a SocketManagerContextProvider');
	}

	return contextValue;
}

export const SocketManagerContextConsumer = context.Consumer;
export const SocketManagerContextProvider = context.Provider;
