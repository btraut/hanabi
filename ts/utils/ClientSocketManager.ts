import * as socket from 'socket.io-client';

import { SocketMessage, AuthenticateSocketMessage } from '../models/SocketMessage';
import Ajax from './Ajax';

export interface ClientSocketManagerSendOptions {
	requireAuth?: boolean;
}

interface ClientSocketManagerExpectation {
	resolve: (message: SocketMessage) => void;
	reject: (error: string) => void;
	isCorrectMessage: (message: SocketMessage) => boolean;
}

class ClientSocketManager {
	// socket.io Client
	private _socket?: SocketIOClient.Socket;
	
	// If this method exists, it means we're connecting to socket.io and
	// the connection hasn't resolved yet.
	private _connectionPromiseResolve?: () => void;
	
	// Connections need authentication after connecting before sending data.
	private _authenticated = false;

	// When we're expecting a message from the server of a specific type,
	// we tracking using an "expectation". This way we can use promises to
	// halt until we receive our expected messages from the server.
	private _expectations: ClientSocketManagerExpectation[] = [];
	
	public async connect() {
		// Turning connect into a promise is complicated. First, we have to
		// treat reconnections different from regular connections. Second,
		// we have to wait for socket.on('connect') to be emitted once
		// connecting before we can resolve.
		if (this._socket) {
			if (!this._socket.connected) {
				return new Promise((resolve) => {
					this._connectionPromiseResolve = resolve;
					
					this._socket!.connect();
				});
			}
		} else {
			return new Promise((resolve) => {
				this._connectionPromiseResolve = resolve;
				
				this._socket = socket('http://localhost:3000');
				
				this._socket.on('connect', this._handleConnect);
				this._socket.on('message', this._handleMessage);
				this._socket.on('disconnect', this._handleDisconnect);
			});
		}
	}
	
	public disconnect() {
		if (this._socket) {   
			this._socket.disconnect();
		}
	}
	
	public send(message: SocketMessage, { requireAuth }: ClientSocketManagerSendOptions = { requireAuth: true }) {
		if (!this._socket || !this._socket.connected) {
			throw new Error('Can’t send a message on a closed socket.io connection.');
		}
		
		if (requireAuth && !this._authenticated) {
			throw new Error('Can’t send a message on unauthenticated socket.io connections.');
		}
		
		this._socket.emit('message', message);
	}
	
	public async expect(isCorrectMessage: (message: SocketMessage) => boolean): Promise<SocketMessage> {
		return new Promise<SocketMessage>((resolve, reject) => {
			this._expectations.push({
				resolve,
				reject,
				isCorrectMessage
			});
		});
	}
	
	public async authenticate() {
		if (!this._socket || !this._socket.connected) {
			throw new Error('Can’t send a message on a closed socket.io connection.');
		}
		
		if (this._authenticated) {
			return;
		}
		
		// Get a token via AJAX (with session cookie).
		const { token } = await Ajax.get('/api/auth-socket');
		
		// Authenticate the socket connection by sending the token.
		this.send({ type: 'AuthenticateSocketMessage', data: token } as AuthenticateSocketMessage, { requireAuth: false });
		
		// Wait for a socket response to authentication.
		const message = await this.expect(response => response.type === 'AuthenticateResponseSocketMessage');
		
		if (message.type === 'AuthenticateResponseSocketMessage') {
			if (message.data.success) {
				this._authenticated = true;
			} else {
				throw new Error(message.data.error);
			}
		}
	}
	
	private _handleConnect = () => {
		console.log('socket.io connected');
		
		if (this._connectionPromiseResolve) {
			const resolve = this._connectionPromiseResolve;
			delete this._connectionPromiseResolve;
			resolve();
		}
	}
	
	private _handleDisconnect = () =>  {
		console.log('socket.io disconnected');
		
		this._authenticated = false;
		
		for (const expectation of this._expectations) {
			expectation.reject('Server disconnected.');
		}
		
		this._expectations = [];
	}
	
	private _handleMessage = (message: SocketMessage) =>  {
		console.log('socket.io data recieved:', message);
		
		// Start tracking the expected messages we've resolved.
		const resolvedExpectations = [];
		
		// Check to see if this message matches any of the expected ones.
		for (const expectation of this._expectations) {
			if (expectation.isCorrectMessage(message)) {
				expectation.resolve(message);
				resolvedExpectations.push(expectation);
			}
		}
		
		// Remove the resolved expected messages from the list.
		for (const resolvedExpectation of resolvedExpectations) {
			const index = this._expectations.indexOf(resolvedExpectation);
			this._expectations.splice(index, 1);
		}
	}
}

const instance = new ClientSocketManager();
export default instance;
