import { SocketMessage, DistributiveOmit, SocketMessageBase } from '@hanabi/shared';
import SocketManager from '../../utils/SocketManager.js';

export default class GameMessenger<MessageType extends SocketMessage<string, unknown>> {
	private _scope: string;
	private _socketManager: SocketManager;
	private _socketManagerOnMessageSubscriptionId: number = 0;
	private _replyTarget: { socketId: string; userId: string } | null = null;

	constructor(socketManager: SocketManager, scope: string) {
		this._socketManager = socketManager;
		this._scope = scope;
	}

	public connect(handler: (data: { userId: string; message: MessageType }) => void): void {
		this._socketManagerOnMessageSubscriptionId = this._socketManager.onMessage.subscribe(
			(data: { socketId: string; userId: string | undefined; message: SocketMessageBase }) => {
				if (data.message.scope !== this._scope) {
					return;
				}

				if (data.userId) {
					this._replyTarget = { socketId: data.socketId, userId: data.userId };
					try {
						handler({ userId: data.userId, message: data.message as MessageType });
					} finally {
						this._replyTarget = null;
					}
				}
			},
		);
	}

	public disconnect(): void {
		this._socketManager.onMessage.unsubscribe(this._socketManagerOnMessageSubscriptionId);
	}

	public send(
		userIdOrIds: string | readonly string[],
		message: DistributiveOmit<MessageType, 'scope'>,
	): void {
		const scopedMessage = {
			...message,
			scope: this._scope,
		} as MessageType;
		if (
			typeof userIdOrIds === 'string' &&
			this._replyTarget?.socketId &&
			this._replyTarget.userId === userIdOrIds &&
			message.type.endsWith('ResponseMessage')
		) {
			this._socketManager.sendToSocket(this._replyTarget.socketId, scopedMessage);
			return;
		}
		this._socketManager.send(userIdOrIds, scopedMessage);
	}
}
