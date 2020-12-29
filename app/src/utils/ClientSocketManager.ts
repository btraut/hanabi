// ClientSocketManager is a singleton utility that handles connections to
// socket.io. In addition to connection/disconnection, ClientSocketManager will
// do an authentication handshake with the server to associate this socket.io
// connection to a user cookie and ultimately his session.

import { io, Socket } from 'socket.io-client';

import { SocketMessageBase } from '../models/SocketMessage';
import PubSub from './PubSub';

export interface ClientSocketManagerSendOptions {
	requireAuth?: boolean;
}

interface ClientSocketManagerExpectation<SocketMessageType> {
	resolve: (message: SocketMessageType) => void;
	reject: (error: string) => void;
	isCorrectMessage: (message: SocketMessageType) => boolean;
	timeoutToken: any;
}

export default class ClientSocketManager<SocketMessageType extends SocketMessageBase> {
	// socket.io Client
	private _socket?: Socket;

	// Event Emitters
	public _onConnect = new PubSub<void>();
	public _onDisconnect = new PubSub<void>();
	public _onMessage = new PubSub<SocketMessageType>();

	// When we're expecting a message from the server of a specific type, we
	// tracking using an "expectation". This way we can use promises to halt
	// until we receive our expected messages from the server.
	private _expectations: ClientSocketManagerExpectation<SocketMessageType>[] = [];

	public get onConnect(): PubSub<void> {
		return this._onConnect;
	}
	public get onDisconnect(): PubSub<void> {
		return this._onDisconnect;
	}
	public get onMessage(): PubSub<SocketMessageType> {
		return this._onMessage;
	}

	public connect(): void {
		// If we haven't created a socket, create one.
		if (!this._socket) {
			this._socket = io(window.location.origin);

			this._socket.on('connect', this._handleConnect);
			this._socket.on('message', this._handleMessage);
			this._socket.on('disconnect', this._handleDisconnect);
		}

		// If the socket is disconnected, connect.
		if (!this._socket.connected) {
			this._socket.connect();
		}
	}

	public disconnect(): void {
		if (this._socket) {
			this._socket.disconnect();
		}
	}

	public send(message: SocketMessageType): void {
		if (!this._socket || !this._socket.connected) {
			throw new Error('Can’t send a message on a closed socket.io connection.');
		}

		this._socket.emit('message', message);
	}

	public async expect(
		isCorrectMessage: (message: SocketMessageType) => boolean,
		timeout = 2000,
	): Promise<SocketMessageType> {
		return new Promise<SocketMessageType>((resolve, reject) => {
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

	private _handleConnect = () => {
		console.log('socket.io connected');

		// Notify others of the connect.
		this._onConnect.emit();
	};

	private _handleDisconnect = () => {
		console.log('socket.io disconnected');

		// Handle expectations.
		for (const expectation of this._expectations) {
			clearTimeout(expectation.timeoutToken);
			expectation.reject('Server disconnected.');
		}

		this._expectations = [];

		// Notify others of the disconnect.
		this._onDisconnect.emit();
	};

	private _handleMessage = (message: SocketMessageType) => {
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
