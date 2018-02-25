// ClientSocketManager.ts
//
// ClientSocketManager is a singleton utility that handles connections to
// socket.io. In addition to connection/disconnection, ClientSocketManager
// will do an authentication handshake with the server to associate this
// socket.io connection to a user cookie and ultimately his session.

import * as socket from 'socket.io-client';

import { SocketMessage, AuthenticateSocketMessage } from '../models/SocketMessage';
import Ajax from './Ajax';
import PubSub from './PubSub';

// Define globals from webpack.
declare const DOMAIN_BASE: string;

export interface ClientSocketManagerSendOptions {
	requireAuth?: boolean;
}

interface ClientSocketManagerExpectation {
	resolve: (message: SocketMessage) => void;
	reject: (error: string) => void;
	isCorrectMessage: (message: SocketMessage) => boolean;
	timeoutToken: any;
}

class ClientSocketManager {
	// socket.io Client
	private _socket?: SocketIOClient.Socket;
	
	// Connections need authentication after connecting before sending data.
	private _authenticated = false;

	// When we're expecting a message from the server of a specific type,
	// we tracking using an "expectation". This way we can use promises to
	// halt until we receive our expected messages from the server.
	private _expectations: ClientSocketManagerExpectation[] = [];
	
	public _onConnect = new PubSub<void>();
	public _onDisconnect = new PubSub<void>();
	public _onMessage = new PubSub<SocketMessage>();
	
	public get onConnect() { return this._onConnect; }
	public get onDisconnect() { return this._onDisconnect; }
	public get onMessage() { return this._onMessage; }
	
	public connect() {
		if (this._socket) {
			if (!this._socket.connected) {
				this._socket!.connect();
			}
		} else {
			this._socket = socket(DOMAIN_BASE);
				
			this._socket.on('connect', this._handleConnect);
			this._socket.on('message', this._handleMessage);
			this._socket.on('disconnect', this._handleDisconnect);
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
			const timeoutToken = setTimeout(() => {
				this._expectations = this._expectations.filter((expectation) => expectation.resolve !== resolve);
				reject('Socket message timed out.');
			}, 2000);
			
			this._expectations.push({
				resolve,
				reject,
				isCorrectMessage,
				timeoutToken
			});
		});
	}
	
	public async expectMessageOfType<T extends SocketMessage>(type: string): Promise<T> {
		return this.expect(response => response.type === type) as Promise<T>;
	}
	
	private async _authenticate() {
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
			if (!message.data.error) {
				this._authenticated = true;
				
				console.log('socket.io authenticated');

				// Notify others of the connect. Note that we've already
				// been connected for a while, but we don't want to notify
				// externally until our connection has been authenticated.
				this._onConnect.emit();
			} else {
				throw new Error(message.data.error);
			}
		}
	}
	
	private _handleConnect = () => {
		console.log('socket.io connected');
		
		this._authenticate();
	}
	
	private _handleDisconnect = () =>  {
		console.log('socket.io disconnected');
		
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
	}
	
	private _handleMessage = (message: SocketMessage) =>  {
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
	}
}

const instance = new ClientSocketManager();
export default instance;
