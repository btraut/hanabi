import SocketManager from 'app/src/utils/server/SocketManager';

export enum UserConnectionChange {
	Authenticated,
	Disconnected,
}

export default class UserConnectionListener {
	private _userConnectionChangeHandler: (userId: string, change: UserConnectionChange) => void;

	private _socketManager: SocketManager<any>;
	private _socketManagerOnAuthenticateSubscriptionId: number;
	private _socketManagerOnDisconnectSubscriptionId: number;

	constructor(
		socketManager: SocketManager<any>,
		userConnectionChangeHandler: (userId: string, change: UserConnectionChange) => void,
	) {
		this._socketManager = socketManager;
		this._userConnectionChangeHandler = userConnectionChangeHandler;

		this._socketManagerOnAuthenticateSubscriptionId = this._socketManager.onAuthenticate.subscribe(
			this._handleAuthenticate,
		);
		this._socketManagerOnDisconnectSubscriptionId = this._socketManager.onDisconnect.subscribe(
			this._handleDisconnect,
		);
	}

	public cleanUp(): void {
		if (this._socketManager === null) {
			return;
		}

		if (this._socketManagerOnAuthenticateSubscriptionId) {
			this._socketManager.onAuthenticate.unsubscribe(
				this._socketManagerOnAuthenticateSubscriptionId,
			);
		}
		if (this._socketManagerOnDisconnectSubscriptionId) {
			this._socketManager.onDisconnect.unsubscribe(this._socketManagerOnDisconnectSubscriptionId);
		}
	}

	private _handleAuthenticate = ({ userId }: { userId: string }): void => {
		this._userConnectionChangeHandler(userId, UserConnectionChange.Authenticated);
	};

	private _handleDisconnect = ({ userId }: { userId: string }): void => {
		this._userConnectionChangeHandler(userId, UserConnectionChange.Disconnected);
	};
}
