import { SocketMessage, DistributiveOmit, SocketMessageBase } from '@hanabi/shared';
import SocketManager from '../../utils/SocketManager.js';

export default class GameMessenger<MessageType extends SocketMessage<string, unknown>> {
	private _scope: string;
	private _socketManager: SocketManager<MessageType>;
	private _socketManagerOnMessageSubscriptionId: number = 0;

	constructor(socketManager: SocketManager<MessageType>, scope: string) {
		this._socketManager = socketManager;
		this._scope = scope;
	}

	public connect(handler: (data: { userId: string; message: MessageType }) => void): void {
		this._socketManagerOnMessageSubscriptionId = this._socketManager.onMessage.subscribe(
			(data: { userId: string | undefined; message: SocketMessageBase }) => {
				if (data.message.scope !== this._scope) {
					return;
				}

				if (data.userId) {
					handler({ userId: data.userId, message: data.message as MessageType });
				}
			}
		);
	}

	public disconnect(): void {
		this._socketManager.onMessage.unsubscribe(this._socketManagerOnMessageSubscriptionId);
	}

	public send(
		userIdOrIds: string | readonly string[],
		message: DistributiveOmit<MessageType, 'scope'>,
	): void {
		this._socketManager.send(userIdOrIds, {
			...message,
			scope: this._scope,
		} as MessageType);
	}
}
