import { SocketMessageBase } from 'app/src/models/SocketMessage';
import AuthSocketManager, { AuthenticationState } from 'app/src/utils/client/AuthSocketManager';
import SocketManager, { ConnectionState } from 'app/src/utils/client/SocketManager';
import { createContext, useContext } from 'react';

interface SocketContext<MessageType extends SocketMessageBase> {
	socketManager: SocketManager<MessageType>;
	authSocketManager: AuthSocketManager;
	connectionState: ConnectionState;
	authenticationState: AuthenticationState;
	userId: string | null;
}

const context = createContext<SocketContext<any> | null>(null);

export function useSocket<MessageType extends SocketMessageBase>(
	requireUserId = false,
): SocketContext<MessageType> {
	const contextValue = useContext(context);

	if (contextValue === null) {
		throw new Error('useSocket must be used within a SocketContextProvider');
	}

	if (requireUserId && !contextValue.userId) {
		throw new Error('No userId specified on socket.');
	}

	return contextValue;
}

export function useUserId(): string {
	const { userId } = useSocket();

	if (!userId) {
		throw new Error('Must connect/join. This should never happen.');
	}

	return userId;
}

export const SocketContextConsumer = context.Consumer;
export const SocketContextProvider = context.Provider;
