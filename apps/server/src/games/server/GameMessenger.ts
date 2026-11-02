import { SocketMessage, DistributiveOmit, SocketMessageBase } from '@hanabi/shared';
import SocketManager from '../../utils/SocketManager.js';
import Logger from '../../utils/Logger.js';

export default class GameMessenger<MessageType extends SocketMessage<string, unknown>> {
	private _scope: string;
	private _socketManager: SocketManager;
	private _socketManagerOnMessageSubscriptionId: number = 0;
	private _replyTarget: { socketId: string; userId: string; requestType: string } | null = null;

	constructor(
		socketManager: SocketManager,
		scope: string,
		private readonly _logContext: () => Readonly<Record<string, unknown>> = () => ({}),
	) {
		this._socketManager = socketManager;
		this._scope = scope;
	}

	public get requestSocketId(): string | undefined {
		return this._replyTarget?.socketId;
	}

	public connect(
		handler: (data: { userId: string; socketId?: string; message: MessageType }) => void,
	): void {
		this._socketManagerOnMessageSubscriptionId = this._socketManager.onMessage.subscribe(
			(data: { socketId: string; userId: string | undefined; message: SocketMessageBase }) => {
				if (data.message.scope !== this._scope) {
					return;
				}

				if (data.userId) {
					this._replyTarget = {
						socketId: data.socketId,
						userId: data.userId,
						requestType: data.message.type,
					};
					try {
						handler({
							userId: data.userId,
							socketId: data.socketId,
							message: data.message as MessageType,
						});
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
		if (
			typeof userIdOrIds === 'string' &&
			message.type.endsWith('ResponseMessage') &&
			typeof message.data === 'object' &&
			message.data !== null &&
			'error' in message.data &&
			typeof message.data.error === 'string'
		) {
			Logger.event(
				'game.request_rejected',
				{
					...this._logContext(),
					scope: this._scope,
					userId: userIdOrIds,
					socketId: this._replyTarget?.socketId,
					requestType: this._replyTarget?.requestType,
					responseType: message.type,
					reason: message.data.error.slice(0, 300),
				},
				'warn',
			);
		}
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
