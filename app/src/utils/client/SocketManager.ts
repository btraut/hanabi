// ClientSocketManager is a singleton utility that handles connections to
// socket.io. In addition to connection/disconnection, ClientSocketManager will
// do an authentication handshake with the server to associate this socket.io
// connection to a user cookie and ultimately his session.

import { io, Socket } from 'socket.io-client';

import { SocketMessageBase } from '../../models/SocketMessage';
import PubSub from '../PubSub';
import {
	AuthenticateSocketMessage,
	AuthenticateSocketResponseMessage,
	SOCKET_MANAGER_SCOPE,
} from '../SocketManagerMessages';
import Ajax from './Ajax';

export interface ClientSocketManagerSendOptions {
	requireAuth?: boolean;
}

interface SocketManagerExpectation {
	resolve: (message: SocketMessageBase) => void;
	reject: (error: string) => void;
	isCorrectMessage: (message: SocketMessageBase) => boolean;
	timeoutToken: any;
}

export default class SocketManager {
	// socket.io Client
	private _socket?: Socket;

	// Have we connected to the server? You probably want to check for
	// authenticated instead of this.
	private _connected = false;
	public get connected(): boolean {
		return this._connected;
	}

	// Connections need authentication after connecting before sending data.
	private _authenticated = false;
	public get authenticated(): boolean {
		return this._authenticated;
	}

	// When we're expecting a message from the server of a specific type,
	// we tracking using an "expectation". This way we can use promises to
	// halt until we receive our expected messages from the server.
	private _expectations: SocketManagerExpectation[] = [];

	public _onConnect = new PubSub<void>();
	public _onAuthenticated = new PubSub<void>();
	public _onDisconnect = new PubSub<void>();
	public _onMessage = new PubSub<SocketMessageBase>();

	public get onConnect(): PubSub<void> {
		return this._onConnect;
	}
	public get onAuthenticated(): PubSub<void> {
		return this._onAuthenticated;
	}
	public get onDisconnect(): PubSub<void> {
		return this._onDisconnect;
	}
	public get onMessage(): PubSub<SocketMessageBase> {
		return this._onMessage;
	}

	public connect(): void {
		if (this._socket) {
			if (!this._socket.connected) {
				this._socket.connect();
			}
		} else {
			this._socket = io(window.location.origin);

			this._socket.on('connect', this._handleConnect);
			this._socket.on('message', this._handleMessage);
			this._socket.on('disconnect', this._handleDisconnect);
		}
	}

	public disconnect(): void {
		if (this._socket) {
			this._socket.disconnect();
		}
	}

	public send(
		message: SocketMessageBase,
		{ requireAuth }: ClientSocketManagerSendOptions = { requireAuth: true },
	): void {
		if (!this._socket || !this._socket.connected) {
			throw new Error('Can’t send a message on a closed socket.io connection.');
		}

		if (requireAuth && !this._authenticated) {
			throw new Error('Can’t send a message on unauthenticated socket.io connections.');
		}

		console.log('socket.io data sent:', message);

		this._socket.emit('message', message);
	}

	public async expect(
		isCorrectMessage: (message: SocketMessageBase) => boolean,
	): Promise<SocketMessageBase> {
		return new Promise<SocketMessageBase>((resolve, reject) => {
			const timeoutToken = setTimeout(() => {
				this._expectations = this._expectations.filter(
					(expectation) => expectation.resolve !== resolve,
				);
				reject('Socket message timed out.');
			}, 2000);

			this._expectations.push({
				resolve,
				reject,
				isCorrectMessage,
				timeoutToken,
			});
		});
	}

	public async expectMessageOfType<T extends SocketMessageBase>(type: string): Promise<T> {
		return this.expect((response) => response.type === type) as Promise<T>;
	}

	private async _authenticate() {
		if (this._authenticated) {
			return;
		}

		if (!this._socket || !this._socket.connected) {
			throw new Error('Can’t send a message on a closed socket.io connection.');
		}

		// Get a token via AJAX (with session cookie).
		const { token } = await Ajax.get('/api/auth-socket');

		// Authenticate the socket connection by sending the token.
		const authenticateSocketMessage: AuthenticateSocketMessage = {
			scope: SOCKET_MANAGER_SCOPE,
			type: 'AuthenticateSocketMessage',
			data: token,
		};
		this.send(authenticateSocketMessage, { requireAuth: false });

		// Wait for a socket response to authentication.
		const message = await this.expectMessageOfType<AuthenticateSocketResponseMessage>(
			'AuthenticateSocketResponseMessage',
		);

		if (message.type === 'AuthenticateSocketResponseMessage') {
			if (!message.data.error) {
				this._authenticated = true;

				console.log('socket.io authenticated');

				// Notify others of the connect. Note that we've already
				// been connected for a while, but we don't want to notify
				// externally until our connection has been authenticated.
				this._onAuthenticated.emit();
			} else {
				throw new Error(message.data.error);
			}
		}
	}

	private _handleConnect = () => {
		console.log('socket.io connected');

		this._connected = true;
		this._onConnect.emit();

		this._authenticate();
	};

	private _handleDisconnect = () => {
		console.log('socket.io disconnected');

		// Reset connection.
		this._connected = false;

		// Reset authentication.
		this._authenticated = false;

		// Handle expectations.
		for (const expectation of this._expectations) {
			clearTimeout(expectation.timeoutToken);
			expectation.reject('Server disconnected.');
		}

		this._expectations = [];

		// Notify others of the disconnect.
		this._onDisconnect.emit();
	};

	private _handleMessage = (message: SocketMessageBase) => {
		console.log('socket.io data recieved:', message);

		// Start tracking the expected messages we've resolved.
		const resolvedExpectations = [];

		// Check to see if this message matches any of the expected ones.
		for (const expectation of this._expectations) {
			if (expectation.isCorrectMessage(message)) {
				clearTimeout(expectation.timeoutToken);
				expectation.resolve(message);
				resolvedExpectations.push(expectation);
			}
		}

		// Remove the resolved expected messages from the list.
		for (const resolvedExpectation of resolvedExpectations) {
			const index = this._expectations.indexOf(resolvedExpectation);
			this._expectations.splice(index, 1);
		}

		// Post the message.
		this._onMessage.emit(message);
	};
}
