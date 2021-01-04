import { SocketContextProvider } from 'app/src/components/SocketContext';
import { SocketMessageBase } from 'app/src/models/SocketMessage';
import AuthSocketManager from 'app/src/utils/client/AuthSocketManager';
import SocketManager from 'app/src/utils/client/SocketManager';
import useAsyncEffect from 'app/src/utils/client/useAsyncEffect';
import useForceRefresh from 'app/src/utils/client/useForceRefresh';
import { useMemo, useRef } from 'react';

interface Props {
	children: JSX.Element;
}

export default function SocketManagerController<MessageType extends SocketMessageBase>({
	children,
}: Props): JSX.Element {
	const socketManagerRef = useRef<SocketManager<MessageType>>();
	const authSocketManagerRef = useRef<AuthSocketManager>();

	const socketManagerOnConnectSubscriptionId = useRef<number | null>(null);
	const socketManagerOnDisconnectSubscriptionId = useRef<number | null>(null);
	const authSocketManagerOnAuthenticateSubscriptionId = useRef<number | null>(null);

	const forceRefresh = useForceRefresh();

	// Initialize the managers.
	if (!socketManagerRef.current) {
		socketManagerRef.current = new SocketManager<MessageType>();

		socketManagerOnConnectSubscriptionId.current = socketManagerRef.current.onConnect.subscribe(
			forceRefresh,
		);
		socketManagerOnDisconnectSubscriptionId.current = socketManagerRef.current.onDisconnect.subscribe(
			forceRefresh,
		);
	}

	if (!authSocketManagerRef.current) {
		authSocketManagerRef.current = new AuthSocketManager(socketManagerRef.current as any);

		authSocketManagerOnAuthenticateSubscriptionId.current = authSocketManagerRef.current.onAuthenticate.subscribe(
			forceRefresh,
		);
	}

	const socketManager = socketManagerRef.current;
	const authSocketManager = authSocketManagerRef.current;
	const connectionState = socketManager.connectionState;
	const authenticationState = authSocketManager.authenticationState;
	const userId = authSocketManager.userId;

	useAsyncEffect(async () => {
		await socketManager.connect();
		await authSocketManager.authenticate();

		return () => {
			socketManager.disconnect();
		};
	}, [socketManager, authSocketManager]);

	const contextValue = useMemo(
		() => ({
			socketManager,
			authSocketManager,
			connectionState,
			authenticationState,
			userId,
		}),
		[socketManager, authSocketManager, connectionState, authenticationState, userId],
	);

	return <SocketContextProvider value={contextValue}>{children}</SocketContextProvider>;
}
