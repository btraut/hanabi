// AuthSocketManager uses a socket manager and AJAX call to "authenticate" the
// user. This is necessary to associate this socket connection with a particular
// user on the server.

import {
	AuthenticateSocketResponseMessage,
	AuthSocketManagerMessage,
	SOCKET_MANAGER_SCOPE,
} from 'app/src/utils/AuthSocketManagerMessages';
import Ajax from 'app/src/utils/client/Ajax';
import SocketManager, { ConnectionState } from 'app/src/utils/client/SocketManager';
import PubSub from 'app/src/utils/PubSub';

export enum AuthenticationState {
	Unauthenticated,
	Authenticating,
	Authenticated,
}

const AUTH_PATH = '/api/auth-socket';

export default class AuthSocketManager {
	// Connections need authentication after connecting before sending data.
	private _authenticationState = AuthenticationState.Unauthenticated;
	public get authenticationState(): AuthenticationState {
		return this._authenticationState;
	}

	// When authenticated, the user gets an id.
	private _userId: string | null = null;
	public get userId(): string | null {
		return this._userId;
	}

	// PubSubs
	public readonly onAuthenticated = new PubSub<void>();

	// Promise for tracking whether or not the user has finished authenticating.
	private _authenticatePromise: Promise<void> | null;
	private _authenticatePromiseResolve: (() => void) | null = null;
	private _authenticatePromiseReject: (() => void) | null = null;

	// SocketManager used for all comms.
	private _socketManager: SocketManager<AuthSocketManagerMessage> | null;

	// Track if the user wants to reconnect after disconnecting.
	private _keepAlive = true;
	private _authenticateCalledAtLeastOnce = false;

	constructor(socketManager: SocketManager<AuthSocketManagerMessage>) {
		this._socketManager = socketManager;

		this._socketManager.onConnect.subscribe(this._handleConnect);
		this._socketManager.onDisconnect.subscribe(this._handleDisconnect);
	}

	public async authenticate(keepAlive = true): Promise<void> {
		if (this._socketManager?.connectionState !== ConnectionState.Connected) {
			throw new Error('Can’t authenticate on a disconnected socket.');
		}

		// Save the "keep alive" setting. We do this even if the user is already
		// connected because it can replace the previous setting.
		this._keepAlive = keepAlive;
		this._authenticateCalledAtLeastOnce = true;

		if (this._authenticationState === AuthenticationState.Authenticated) {
			return;
		}

		if (
			this._authenticationState === AuthenticationState.Authenticating &&
			this._authenticatePromise
		) {
			return this._authenticatePromise;
		}

		this._authenticatePromise = new Promise<void>((resolve, reject) => {
			this._authenticatePromiseResolve = resolve;
			this._authenticatePromiseReject = reject;
		});

		// Get a token via AJAX (with session cookie).
		const { token } = await Ajax.get(AUTH_PATH);

		// Authenticate the socket connection by sending the token.
		this._socketManager.send({
			scope: SOCKET_MANAGER_SCOPE,
			type: 'AuthenticateSocketMessage',
			data: token,
		});

		// Wait for a socket response to authentication.
		const message = await this._socketManager.expectMessageOfType<AuthenticateSocketResponseMessage>(
			'AuthenticateSocketResponseMessage',
		);

		if (message.data.error) {
			throw new Error(message.data.error);
		}

		this._authenticationState = AuthenticationState.Authenticated;
		this._userId = message.data.userId!;

		console.log(`socket.io authenticated, user id: ${this._userId}`);

		// Notify others of the connect. Note that we've already
		// been connected for a while, but we don't want to notify
		// externally until our connection has been authenticated.
		this.onAuthenticated.emit();

		// Resolve the authentication promise.
		if (this._authenticatePromiseResolve) {
			this._authenticatePromiseResolve();
		}

		// Clean up the promise callbacks.
		this._authenticatePromise = null;
		this._authenticatePromiseResolve = null;
		this._authenticatePromiseReject = null;
	}

	private _handleConnect = () => {
		console.log('connect authasdf!');

		if (this._keepAlive && this._authenticateCalledAtLeastOnce) {
			this.authenticate(this._keepAlive);
		}
	};

	private _handleDisconnect = () => {
		this._authenticationState = AuthenticationState.Unauthenticated;

		// If there's a lingering authenticate promise, reject it.
		if (this._authenticatePromiseReject) {
			this._authenticatePromiseReject();
		}

		// Clean up the promise callbacks.
		this._authenticatePromise = null;
		this._authenticatePromiseResolve = null;
		this._authenticatePromiseReject = null;
	};
}
