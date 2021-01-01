import useForceRefresh from 'app/src/utils/client/useForceRefresh';
import { createContext, useContext, useEffect, useRef } from 'react';

import SocketManager from '../utils/client/SocketManager';

const context = createContext<SocketManager | null>(null);

export function useSocketManager(refreshOnUpdate = true): SocketManager {
	const socketManager = useContext(context);

	const socketManagerOnConnectSubscriptionId = useRef<number | null>(null);
	const socketManagerOnAuthenticateSubscriptionId = useRef<number | null>(null);
	const socketManagerOnDisconnectSubscriptionId = useRef<number | null>(null);

	const forceRefresh = useForceRefresh();

	// We need to update components whenever the game manager updates its state.
	// It's expected that
	useEffect(() => {
		if (socketManager && refreshOnUpdate) {
			socketManagerOnConnectSubscriptionId.current = socketManager.onConnect.subscribe(
				forceRefresh,
			);
			socketManagerOnAuthenticateSubscriptionId.current = socketManager.onAuthenticated.subscribe(
				forceRefresh,
			);
			socketManagerOnDisconnectSubscriptionId.current = socketManager.onDisconnect.subscribe(
				forceRefresh,
			);
		}

		return () => {
			if (socketManager) {
				if (socketManagerOnConnectSubscriptionId.current !== null) {
					socketManager.onConnect.unsubscribe(socketManagerOnConnectSubscriptionId.current);
					socketManagerOnConnectSubscriptionId.current = null;
				}
				if (socketManagerOnAuthenticateSubscriptionId.current !== null) {
					socketManager.onAuthenticated.unsubscribe(
						socketManagerOnAuthenticateSubscriptionId.current,
					);
					socketManagerOnAuthenticateSubscriptionId.current = null;
				}
				if (socketManagerOnDisconnectSubscriptionId.current !== null) {
					socketManager.onDisconnect.unsubscribe(socketManagerOnDisconnectSubscriptionId.current);
					socketManagerOnDisconnectSubscriptionId.current = null;
				}
			}
		};
	}, [forceRefresh, socketManager, refreshOnUpdate]);

	if (socketManager === null) {
		throw new Error('useSocketManager must be used within a SocketManagerContextProvider');
	}

	return socketManager;
}

export const SocketManagerContextConsumer = context.Consumer;
export const SocketManagerContextProvider = context.Provider;
