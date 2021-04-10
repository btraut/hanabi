// GameMessenger is a utility that Games may use to make sending and recieving
// socket messages easier. It binds a message handler function to a
// SocketManager's onMessage event and also exposes the socket manager's send()
// method, both of which are strongly-typed to the specified MessageType.

import { SocketMessage } from 'app/src/models/SocketMessage';
import DistributiveOmit from 'app/src/utils/DistributiveOmit';
import SocketManager from 'app/src/utils/server/SocketManager';

export default class GameMessenger<MessageType extends SocketMessage<any, any>> {
	private _scope: string;
	private _socketManager: SocketManager<MessageType>;
	private _socketManagerOnMessageSubscriptionId: number;

	constructor(socketManager: SocketManager<MessageType>, scope: string) {
		this._socketManager = socketManager;
		this._scope = scope;
	}

	public connect(handler: (data: { userId: string; message: MessageType }) => void): void {
		this._socketManagerOnMessageSubscriptionId = this._socketManager.onMessage.subscribe(
			GameMessenger._createScopedHandler<MessageType>(this._scope, handler),
		);
	}

	private static _createScopedHandler<M extends SocketMessage<any, any>>(
		scope: string,
		handler: (data: { userId: string; message: SocketMessage<any, any> }) => void,
	) {
		return (data: { userId: string; message: M }) => {
			if (data.message.scope !== scope) {
				return;
			}

			// At this point, we presume that the scope check has limited the
			// message type to only those used in this game. It's possible that
			// this is not true in practice, but we should never be sending
			// messages cross- game type or even cross-game.
			handler(data as any);
		};
	}

	public disconnect(): void {
		this._socketManager.onMessage.unsubscribe(this._socketManagerOnMessageSubscriptionId);
	}

	public send(
		userIdOrIds: string | readonly string[],
		message: DistributiveOmit<MessageType, 'scope'>,
	): void {
		// Scope the message to the supplied scope.
		// TODO: Fix this any type.
		this._socketManager.send(userIdOrIds, {
			...message,
			scope: this._scope,
		} as any);
	}
}
