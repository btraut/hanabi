// SocketManager is a singleton utility that handles connections to socket.io.

import { SocketMessageBase, PubSub } from '@hanabi/shared';
import { io, Socket } from 'socket.io-client';

interface SocketManagerExpectation<MessageType> {
	resolve: (message: MessageType) => void;
	reject: (error: string) => void;
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
	private _connectPromiseReject: (() => void) | null = null;

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

		if (!this._socket) {
			this._socket = io(window.location.origin);

			this._socket.on('connect', this._handleConnect);
			this._socket.on('message', this._handleMessage);
			this._socket.on('disconnect', this._handleDisconnect);
		}

		this._socket.connect();

		this._connectPromise = new Promise<void>((resolve, reject) => {
			this._connectPromiseResolve = resolve;
			this._connectPromiseReject = reject;
		});

		return this._connectPromise;
	}

	public disconnect(): void {
		if (this._connectionState === ConnectionState.Disconnected) {
			return;
		}

		this._socket?.disconnect();
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
				reject('Socket message timed out.');
			}, timeout);

			this._expectations.push({
				resolve,
				reject,
				isCorrectMessage,
				timeoutToken,
			});
		});
	}

	public async expectMessageOfType<T extends MessageType>(type: string): Promise<T> {
		return this.expect((response) => response.type === type) as Promise<T>;
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
		console.log('socket.io disconnected');

		// Reset connection state.
		this._connectionState = ConnectionState.Disconnected;

		// Reject any remaining expectations.
		for (const expectation of this._expectations) {
			clearTimeout(expectation.timeoutToken);
			expectation.reject('Server disconnected.');
		}

		this._expectations = [];

		// Notify others of the disconnect.
		this.onDisconnect.emit();

		// If there's a lingering connection promise, reject it.
		if (this._connectPromiseReject) {
			this._connectPromiseReject();
		}

		// Clean up the promise callbacks.
		this._connectPromise = null;
		this._connectPromiseResolve = null;
		this._connectPromiseReject = null;
	};

	private _handleMessage = (message: MessageType) => {
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
		this.onMessage.emit(message);
	};
}
