import { SocketMessageBase } from '@hanabi/shared';
import AuthSocketManager, { AuthenticationState } from '~/utils/client/AuthSocketManager';
import SocketManager, { ConnectionState } from '~/utils/client/SocketManager';
import { createContext, useContext } from 'react';

interface SocketContext<MessageType extends SocketMessageBase> {
	socketManager: SocketManager<MessageType>;
	authSocketManager: AuthSocketManager;
	connectionState: ConnectionState;
	authenticationState: AuthenticationState;
	userId: string | null;
}

// React contexts cannot preserve a type parameter at runtime. Store an erased
// value and restore the caller's message type at this single boundary.
const context = createContext<unknown>(null);

export function useSocket<MessageType extends SocketMessageBase>(
	requireUserId = false,
): SocketContext<MessageType> {
	const contextValue = useContext(context);

	if (contextValue === null) {
		throw new Error('useSocket must be used within a SocketContextProvider');
	}
	const typedContext = contextValue as SocketContext<MessageType>;

	if (requireUserId && !typedContext.userId) {
		throw new Error('No userId specified on socket.');
	}

	return typedContext;
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
