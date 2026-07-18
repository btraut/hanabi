// AuthSocketManager uses a socket manager and AJAX call to "authenticate" the
// user. This is necessary to associate this socket connection with a particular
// user on the server.

import {
	AuthenticateSocketResponseMessage,
	AuthSocketManagerMessage,
	SOCKET_MANAGER_SCOPE,
	PubSub,
} from '@hanabi/shared';
import Ajax from './Ajax';
import SocketManager, { ConnectionState } from './SocketManager';

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
	public readonly onAuthenticate = new PubSub<void>();

	// One shared operation for callers waiting on the current authentication attempt.
	private _authenticatePromise: Promise<void> | null = null;
	private _authenticationAttempt = 0;

	// SocketManager used for all comms.
	private readonly _socketManager: SocketManager<AuthSocketManagerMessage>;

	// Track if the user wants to reconnect after disconnecting.
	private _keepAlive = true;
	private _authenticateCalledAtLeastOnce = false;

	constructor(socketManager: SocketManager<AuthSocketManagerMessage>) {
		this._socketManager = socketManager;

		this._socketManager.onConnect.subscribe(this._handleConnect);
		this._socketManager.onDisconnect.subscribe(this._handleDisconnect);
	}

	public authenticate(keepAlive = true): Promise<void> {
		if (this._socketManager.connectionState !== ConnectionState.Connected) {
			return Promise.reject(new Error('Can’t authenticate on a disconnected socket.'));
		}

		// Save the "keep alive" setting. We do this even if the user is already
		// connected because it can replace the previous setting.
		this._keepAlive = keepAlive;
		this._authenticateCalledAtLeastOnce = true;

		if (this._authenticationState === AuthenticationState.Authenticated) {
			return Promise.resolve();
		}

		if (
			this._authenticationState === AuthenticationState.Authenticating &&
			this._authenticatePromise
		) {
			return this._authenticatePromise;
		}

		this._authenticationState = AuthenticationState.Authenticating;
		const attempt = ++this._authenticationAttempt;
		const authentication = this._performAuthentication(attempt);
		this._authenticatePromise = authentication;

		// Clear only the operation that just settled. Supplying both handlers keeps
		// this bookkeeping chain fulfilled even when authentication fails.
		void authentication.then(
			() => this._clearAuthenticationPromise(authentication),
			() => this._clearAuthenticationPromise(authentication),
		);

		return authentication;
	}

	private async _performAuthentication(attempt: number): Promise<void> {
		try {
			// Get a token via AJAX (with session cookie).
			const { token } = await Ajax.get<{ token: string }>(AUTH_PATH);
			this._assertCurrentAttempt(attempt);

			// Authenticate the socket connection by sending the token.
			this._socketManager.send({
				scope: SOCKET_MANAGER_SCOPE,
				type: 'AuthenticateSocketMessage',
				data: token,
			});

			// Wait for a socket response to authentication.
			const message =
				await this._socketManager.expectMessageOfType<AuthenticateSocketResponseMessage>(
					'AuthenticateSocketResponseMessage',
					SOCKET_MANAGER_SCOPE,
				);
			this._assertCurrentAttempt(attempt);

			if (message.data.error) {
				throw new Error(message.data.error);
			}

			this._authenticationState = AuthenticationState.Authenticated;
			this._userId = message.data.userId!;

			console.log(`socket.io authenticated, user id: ${this._userId}`);

			// Notify others of the connect. Note that we've already
			// been connected for a while, but we don't want to notify
			// externally until our connection has been authenticated.
			this.onAuthenticate.emit();
		} catch (error) {
			if (attempt === this._authenticationAttempt) {
				this._authenticationState = AuthenticationState.Unauthenticated;
				this._userId = null;
			}
			throw error;
		}
	}

	private _assertCurrentAttempt(attempt: number): void {
		if (
			attempt !== this._authenticationAttempt ||
			this._socketManager.connectionState !== ConnectionState.Connected
		) {
			throw new Error('Socket authentication was interrupted.');
		}
	}

	private _clearAuthenticationPromise(authentication: Promise<void>): void {
		if (this._authenticatePromise === authentication) {
			this._authenticatePromise = null;
		}
	}

	private _handleConnect = () => {
		if (this._keepAlive && this._authenticateCalledAtLeastOnce) {
			void this.authenticate(this._keepAlive).catch((error: unknown) => {
				console.error('Socket reauthentication failed:', error);
			});
		}
	};

	private _handleDisconnect = () => {
		this._authenticationAttempt += 1;
		this._authenticationState = AuthenticationState.Unauthenticated;
		this._userId = null;
		this._authenticatePromise = null;
	};
}
