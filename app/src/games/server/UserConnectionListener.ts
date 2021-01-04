import SocketManager from 'app/src/utils/server/SocketManager';

export enum UserConnectionChange {
	Authenticated,
	Disconnected,
}

export default class UserConnectionListener {
	private _socketManager: SocketManager<any>;
	private _socketManagerOnAuthenticateSubscriptionId: number | null;
	private _socketManagerOnDisconnectSubscriptionId: number | null;

	constructor(socketManager: SocketManager<any>) {
		this._socketManager = socketManager;
	}

	public start(
		userConnectionChangeHandler: (userId: string, change: UserConnectionChange) => void,
	): void {
		this._socketManagerOnAuthenticateSubscriptionId = this._socketManager.onAuthenticate.subscribe(
			({ userId }: { userId: string }): void => {
				userConnectionChangeHandler(userId, UserConnectionChange.Authenticated);
			},
		);
		this._socketManagerOnDisconnectSubscriptionId = this._socketManager.onDisconnect.subscribe(
			({ userId }: { userId: string }): void => {
				userConnectionChangeHandler(userId, UserConnectionChange.Disconnected);
			},
		);
	}

	public stop(): void {
		if (this._socketManagerOnAuthenticateSubscriptionId !== null) {
			this._socketManager.onAuthenticate.unsubscribe(
				this._socketManagerOnAuthenticateSubscriptionId,
			);
		}
		if (this._socketManagerOnDisconnectSubscriptionId !== null) {
			this._socketManager.onDisconnect.unsubscribe(this._socketManagerOnDisconnectSubscriptionId);
		}
	}
}
