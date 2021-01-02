// GameMessenger is a utility that Games may use to make sending and recieving
// socket messages easier. It binds a message handler function to a
// SocketManager's onMessage event and also exposes the socket manager's send()
// method, both of which are strongly-typed to the specified MessageType.

import { SocketMessageBase } from 'app/src/models/SocketMessage';
import SocketManager from 'app/src/utils/server/SocketManager';

export default class GameMessenger<MessageType extends SocketMessageBase> {
	private _scope: string;
	private _messageHandler: (data: { userId: string; message: MessageType }) => void;

	private _socketManager: SocketManager<MessageType> | null = null;
	private _socketManagerOnMessageSubscriptionId: number | null = null;

	constructor(
		scope: string,
		socketManager: SocketManager<MessageType>,
		messageHandler: (data: { userId: string; message: SocketMessageBase }) => void,
	) {
		this._scope = scope;
		this._socketManager = socketManager;
		this._messageHandler = messageHandler;

		this._socketManagerOnMessageSubscriptionId = this._socketManager.onMessage.subscribe(
			this._filterMessage,
		);
	}

	public cleanUp(): void {
		if (this._socketManager === null || this._socketManagerOnMessageSubscriptionId === null) {
			return;
		}

		this._socketManager.onMessage.unsubscribe(this._socketManagerOnMessageSubscriptionId);
		this._socketManagerOnMessageSubscriptionId = null;

		this._socketManager = null;
	}

	private _filterMessage = (data: { userId: string; message: MessageType }): void => {
		if (data.message.scope !== this._scope) {
			return;
		}

		// At this point, we presume that the scope check has limited the
		// message type to only those used in this game. It's possible that
		// this is not true in practice, but we should never be sending
		// messages cross- game type or even cross-game.
		this._messageHandler(data as any);
	};

	public send(userIdOrIds: string | readonly string[], message: MessageType): void {
		if (!this._socketManager) {
			throw new Error('No socket manager specified.');
		}

		this._socketManager.send(userIdOrIds, message);
	}
}
