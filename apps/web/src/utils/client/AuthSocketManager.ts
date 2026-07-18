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
const DEFAULT_REAUTHENTICATION_DELAYS = [250, 500, 1000] as const;

interface AuthSocketManagerOptions {
	readonly reauthenticationDelays?: readonly number[];
}

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
	private _reauthenticationRun = 0;
	private _activeReauthenticationRun: number | null = null;
	private readonly _reauthenticationDelays: readonly number[];

	// SocketManager used for all comms.
	private readonly _socketManager: SocketManager<AuthSocketManagerMessage>;

	// Track if the user wants to reconnect after disconnecting.
	private _keepAlive = true;
	private _authenticateCalledAtLeastOnce = false;

	constructor(
		socketManager: SocketManager<AuthSocketManagerMessage>,
		options: AuthSocketManagerOptions = {},
	) {
		this._socketManager = socketManager;
		this._reauthenticationDelays =
			options.reauthenticationDelays ?? DEFAULT_REAUTHENTICATION_DELAYS;

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
			() => {
				this._clearAuthenticationPromise(authentication);
				if (
					this._keepAlive &&
					attempt === this._authenticationAttempt &&
					this._socketManager.connectionState === ConnectionState.Connected
				) {
					this._startAutomaticReauthentication(true);
				}
			},
		);

		return authentication;
	}

	private async _performAuthentication(attempt: number): Promise<void> {
		try {
			// Get a token via AJAX (with session cookie).
			const response: unknown = await Ajax.get<unknown>(AUTH_PATH);
			this._assertCurrentAttempt(attempt);
			const token =
				typeof response === 'object' &&
				response !== null &&
				'token' in response &&
				typeof response.token === 'string' &&
				response.token.length > 0
					? response.token
					: null;
			if (!token) {
				throw new Error('Authentication did not return a valid socket token.');
			}

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

			if (message.data?.error) {
				throw new Error(message.data.error);
			}
			if (typeof message.data?.userId !== 'string' || message.data.userId.length === 0) {
				throw new Error('Authentication did not return a valid user id.');
			}

			this._authenticationState = AuthenticationState.Authenticated;
			this._userId = message.data.userId;

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
			this._startAutomaticReauthentication(false);
		}
	};

	private _startAutomaticReauthentication(waitBeforeFirstAttempt: boolean): void {
		if (this._activeReauthenticationRun !== null) return;

		const run = ++this._reauthenticationRun;
		this._activeReauthenticationRun = run;
		void this._reauthenticate(run, waitBeforeFirstAttempt).finally(() => {
			if (this._activeReauthenticationRun === run) {
				this._activeReauthenticationRun = null;
			}
		});
	}

	private async _reauthenticate(run: number, waitBeforeFirstAttempt: boolean): Promise<void> {
		let lastError: unknown;
		const attemptDelays = waitBeforeFirstAttempt
			? this._reauthenticationDelays
			: [0, ...this._reauthenticationDelays];

		for (const delay of attemptDelays) {
			if (delay > 0) {
				await new Promise<void>((resolve) => setTimeout(resolve, delay));
			}
			if (
				run !== this._reauthenticationRun ||
				this._socketManager.connectionState !== ConnectionState.Connected
			) {
				return;
			}

			try {
				await this.authenticate(this._keepAlive);
				return;
			} catch (error) {
				lastError = error;
			}
		}

		if (
			run === this._reauthenticationRun &&
			this._socketManager.connectionState === ConnectionState.Connected
		) {
			console.error('Socket reauthentication failed:', lastError);
		}
	}

	private _handleDisconnect = () => {
		this._reauthenticationRun += 1;
		this._activeReauthenticationRun = null;
		this._authenticationAttempt += 1;
		this._authenticationState = AuthenticationState.Unauthenticated;
		this._userId = null;
		this._authenticatePromise = null;
	};
}
