// SocketManager is a singleton utility that handles connections to socket.io.

import { SocketMessageBase, PubSub } from '@hanabi/shared';
import { io, Socket } from 'socket.io-client';

interface SocketManagerExpectation<MessageType> {
	resolve: (message: MessageType) => void;
	reject: (error: Error) => void;
	isCorrectMessage: (message: MessageType) => boolean;
	timeoutToken: ReturnType<typeof setTimeout>;
}

export enum ConnectionState {
	Disconnected,
	Connecting,
	Connected,
}

export default class SocketManager<MessageType extends SocketMessageBase> {
	// Have we connected to the server?
	private _connectionState = ConnectionState.Disconnected;
	public get connectionState(): ConnectionState {
		return this._connectionState;
	}

	// PubSubs
	public readonly onConnect = new PubSub<void>();
	public readonly onDisconnect = new PubSub<void>();
	public readonly onMessage = new PubSub<MessageType>();

	// Promise for tracking whether or not the user has finished connecting.
	private _connectPromise: Promise<void> | null = null;
	private _connectPromiseResolve: (() => void) | null = null;
	private _connectPromiseReject: ((error: Error) => void) | null = null;

	// socket.io Client
	private _socket: Socket | null = null;

	// When we're expecting a message from the server of a specific type,
	// we tracking using an "expectation". This way we can use promises to
	// halt until we receive our expected messages from the server.
	private _expectations: SocketManagerExpectation<MessageType>[] = [];

	public async connect(): Promise<void> {
		if (this._connectionState === ConnectionState.Connected) {
			return;
		}

		if (this._connectionState === ConnectionState.Connecting && this._connectPromise) {
			return this._connectPromise;
		}

		this._connectionState = ConnectionState.Connecting;
		this._connectPromise = new Promise<void>((resolve, reject) => {
			this._connectPromiseResolve = resolve;
			this._connectPromiseReject = reject;
		});

		if (!this._socket) {
			this._socket = io(window.location.origin, { autoConnect: false });

			this._socket.on('connect', this._handleConnect);
			this._socket.on('connect_error', this._handleConnectError);
			this._socket.on('message', this._handleMessage);
			this._socket.on('disconnect', this._handleDisconnect);
		}

		this._socket.connect();

		return this._connectPromise;
	}

	public disconnect(): void {
		if (this._connectionState === ConnectionState.Disconnected) {
			return;
		}

		this._socket?.disconnect();

		// socket.io does not emit `disconnect` when a connection attempt is
		// cancelled before it reaches the connected state.
		this._handleDisconnect();
	}

	public send(message: MessageType): void {
		if (!this._socket || this._connectionState !== ConnectionState.Connected) {
			throw new Error('Can’t send a message on a closed socket.io connection.');
		}

		console.log('socket.io data sent:', message);

		this._socket.emit('message', message);
	}

	public async expect(
		isCorrectMessage: (message: MessageType) => boolean,
		timeout = 2000,
	): Promise<MessageType> {
		return new Promise<MessageType>((resolve, reject) => {
			const timeoutToken = setTimeout(() => {
				this._expectations = this._expectations.filter(
					(expectation) => expectation.resolve !== resolve,
				);
				reject(new Error('Socket message timed out.'));
			}, timeout);

			this._expectations.push({
				resolve,
				reject,
				isCorrectMessage,
				timeoutToken,
			});
		});
	}

	public async expectMessageOfType<T extends MessageType>(
		type: string,
		scope?: string,
	): Promise<T> {
		return this.expect(
			(response) => response.type === type && (scope === undefined || response.scope === scope),
		) as Promise<T>;
	}

	private _handleConnect = () => {
		console.log('socket.io connected');

		this._connectionState = ConnectionState.Connected;

		this.onConnect.emit();

		// Resolve the connection promise.
		if (this._connectPromiseResolve) {
			this._connectPromiseResolve();
		}

		// Clean up the promise callbacks.
		this._connectPromise = null;
		this._connectPromiseResolve = null;
		this._connectPromiseReject = null;
	};

	private _handleDisconnect = () => {
		if (this._connectionState === ConnectionState.Disconnected) {
			return;
		}

		console.log('socket.io disconnected');

		// Reset connection state.
		this._connectionState = ConnectionState.Disconnected;

		// Reject any remaining expectations.
		for (const expectation of this._expectations) {
			clearTimeout(expectation.timeoutToken);
			expectation.reject(new Error('Server disconnected.'));
		}

		this._expectations = [];

		// Notify others of the disconnect.
		this.onDisconnect.emit();

		// If there's a lingering connection promise, reject it.
		if (this._connectPromiseReject) {
			this._connectPromiseReject(new Error('Server disconnected.'));
		}

		// Clean up the promise callbacks.
		this._connectPromise = null;
		this._connectPromiseResolve = null;
		this._connectPromiseReject = null;
	};

	private _handleConnectError = (error: Error) => {
		this._connectionState = ConnectionState.Disconnected;
		this._connectPromiseReject?.(error);
		this._connectPromise = null;
		this._connectPromiseResolve = null;
		this._connectPromiseReject = null;
	};

	private _handleMessage = (message: MessageType) => {
		console.log('socket.io data recieved:', message);

		// A response can satisfy only the oldest matching request. Resolving every
		// match lets one server response incorrectly complete concurrent commands.
		const expectationIndex = this._expectations.findIndex((expectation) =>
			expectation.isCorrectMessage(message),
		);
		if (expectationIndex !== -1) {
			const [expectation] = this._expectations.splice(expectationIndex, 1);
			clearTimeout(expectation.timeoutToken);
			expectation.resolve(message);
		}

		// Post the message.
		this.onMessage.emit(message);
	};
}
