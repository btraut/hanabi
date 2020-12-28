import { createContext, useContext } from 'react';

import ClientSocketManager from '../utils/ClientSocketManager';

const context = createContext<ClientSocketManager<any> | null>(null);

export function useClientSocketManagerContext(): ClientSocketManager<any> {
	const contextValue = useContext(context);

	if (contextValue === null) {
		throw new Error(
			'useClientSocketManagerContext must be used within a ClientSocketManagerContextProvider',
		);
	}

	return contextValue;
}

export const ClientSocketManagerContextConsumer = context.Consumer;
export const ClientSocketManagerContextProvider = context.Provider;
