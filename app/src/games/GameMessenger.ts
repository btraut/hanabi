// GameMessenger is a utility that Games may use to make sending and recieving
// socket messages easier. It binds a message handler function to a
// ServerSocketManager's onMessage event and also exposes the socket manager's
// send() method, both of which are strongly-typed to the specified MessageType.

import { SocketMessageBase } from 'app/src/models/SocketMessage';
import ServerSocketManager from 'app/src/utils/ServerSocketManager';

export default class GameMessenger<MessageType extends SocketMessageBase> {
	private _scope: string;
	private _messageHandler: (d: { userId: string; message: SocketMessageBase }) => void;

	private _socketManager: ServerSocketManager<MessageType> | null = null;
	private _socketManagerOnMessageSubscriptionId: number | null = null;

	constructor(
		scope: string,
		messageHandler: (d: { userId: string; message: SocketMessageBase }) => void,
	) {
		this._scope = scope;
		this._messageHandler = messageHandler;
	}

	public bindSocketManager(socketManager: ServerSocketManager<MessageType>): void {
		this._socketManager = socketManager;
		this._socketManagerOnMessageSubscriptionId = this._socketManager.onMessage.subscribe(
			this._filterMessage,
		);
	}

	public unbindSocketManager(): void {
		if (!this._socketManager) {
			throw new Error('No socket manager specified.');
		}

		if (this._socketManagerOnMessageSubscriptionId !== null) {
			this._socketManager.onMessage.unsubscribe(this._socketManagerOnMessageSubscriptionId);
			this._socketManagerOnMessageSubscriptionId = null;
		}

		this._socketManager = null;
	}

	private _filterMessage(data: { userId: string; message: SocketMessageBase }): void {
		if (data.message.scope !== this._scope) {
			return;
		}

		this._messageHandler(data);
	}

	public send(idOrIds: string | readonly string[], message: MessageType): void {
		if (!this._socketManager) {
			throw new Error('No socket manager specified.');
		}

		this._socketManager.send(idOrIds, message);
	}
}
