import { SocketContextProvider } from '~/components/SocketContext';
import { AuthSocketManagerMessage, SocketMessageBase } from '@hanabi/shared';
import AuthSocketManager, { AuthenticationState } from '~/utils/client/AuthSocketManager';
import SocketManager from '~/utils/client/SocketManager';
import useForceRefresh from '~/utils/client/useForceRefresh';
import { useEffect, useMemo, useRef } from 'react';

interface Props {
	readonly children: JSX.Element | JSX.Element[] | null;
}

export default function SocketManagerController<MessageType extends SocketMessageBase>({
	children,
}: Props): JSX.Element {
	const socketManagerRef = useRef<SocketManager<MessageType> | null>(null);
	const authSocketManagerRef = useRef<AuthSocketManager | null>(null);

	const forceRefresh = useForceRefresh();

	// Initialize the managers.
	if (!socketManagerRef.current) {
		socketManagerRef.current = new SocketManager<MessageType>();
	}

	if (!authSocketManagerRef.current) {
		authSocketManagerRef.current = new AuthSocketManager(
			socketManagerRef.current as unknown as SocketManager<AuthSocketManagerMessage>,
		);
	}

	const socketManager = socketManagerRef.current;
	const authSocketManager = authSocketManagerRef.current;
	const connectionState = socketManager.connectionState;
	const authenticationState = authSocketManager.authenticationState;
	const userId = authSocketManager.userId;

	useEffect(() => {
		let active = true;
		const handleConnect = () => {
			forceRefresh();
			if (authSocketManager.authenticationState === AuthenticationState.Unauthenticated) {
				void authSocketManager.authenticate().catch((error: unknown) => {
					if (active) {
						console.error('Socket authentication failed:', error);
					}
				});
			}
		};

		const onConnectSubscriptionId = socketManager.onConnect.subscribe(handleConnect);
		const onDisconnectSubscriptionId = socketManager.onDisconnect.subscribe(forceRefresh);
		const onAuthenticateSubscriptionId = authSocketManager.onAuthenticate.subscribe(forceRefresh);

		void socketManager.connect().catch((error: unknown) => {
			if (active) {
				console.error('Socket connection failed:', error);
			}
		});

		return () => {
			active = false;
			socketManager.onConnect.unsubscribe(onConnectSubscriptionId);
			socketManager.onDisconnect.unsubscribe(onDisconnectSubscriptionId);
			authSocketManager.onAuthenticate.unsubscribe(onAuthenticateSubscriptionId);
			socketManager.disconnect();
		};
	}, [socketManager, authSocketManager, forceRefresh]);

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
