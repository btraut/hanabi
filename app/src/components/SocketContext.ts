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

export function useSocket<MessageType extends SocketMessageBase>(): SocketContext<MessageType> {
	const contextValue = useContext(context);

	if (contextValue === null) {
		throw new Error('useSocket must be used within a SocketContextProvider');
	}

	return contextValue;
}

export const SocketContextConsumer = context.Consumer;
export const SocketContextProvider = context.Provider;
