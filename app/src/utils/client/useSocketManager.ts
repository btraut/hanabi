import { useSocketManagerContext } from 'app/src/components/SocketManagerContext';
import ClientSocketManager from 'app/src/utils/client/SocketManager';
import useForceRefresh from 'app/src/utils/client/useForceRefresh';
import usePubSub from 'app/src/utils/client/usePubSub';
import { useEffect } from 'react';

export default function useSocketManager(): ClientSocketManager {
	const socketManager = useSocketManagerContext();

	useEffect(() => {
		socketManager.connect();

		return () => {
			socketManager.disconnect();
		};
	}, [socketManager]);

	const forceRefresh = useForceRefresh();

	usePubSub(socketManager.onMessage, forceRefresh);
	usePubSub(socketManager.onAuthenticated, forceRefresh);
	usePubSub(socketManager.onDisconnect, forceRefresh);
	usePubSub(socketManager.onConnect, forceRefresh);

	return socketManager;
}
